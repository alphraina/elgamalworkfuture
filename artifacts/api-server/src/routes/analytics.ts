import { Router } from "express";
import { pool } from "@workspace/db";
import { getCurrentUser } from "../lib/current-user.js";

const router = Router();

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const days = Math.min(365, Math.max(7, parseInt(String(req.query.days ?? "30"), 10)));

  try {
    const since = `NOW() - INTERVAL '${days} days'`;

    const summaryRes = await pool.query(`
      SELECT
        COUNT(*) AS total_incidents,
        COALESCE(SUM(duration_minutes), 0) AS total_downtime_minutes,
        COALESCE(AVG(CASE WHEN status = 'resolved' AND duration_minutes IS NOT NULL THEN duration_minutes END), 0) AS avg_mttr_minutes,
        COUNT(CASE WHEN status = 'ongoing' THEN 1 END) AS open_incidents
      FROM downtime_records
      WHERE start_time >= ${since}
    `);
    const s = summaryRes.rows[0];

    const mttrRes = await pool.query(`
      SELECT
        machine_name,
        machine_code,
        COUNT(*) AS incidents,
        ROUND(AVG(duration_minutes)::numeric, 1) AS avg_mttr_minutes,
        ROUND(SUM(duration_minutes)::numeric, 1) AS total_downtime_minutes
      FROM downtime_records
      WHERE status = 'resolved' AND duration_minutes IS NOT NULL AND start_time >= ${since}
      GROUP BY machine_name, machine_code
      ORDER BY avg_mttr_minutes DESC
      LIMIT 15
    `);

    const mtbfRes = await pool.query(`
      WITH ordered AS (
        SELECT
          machine_name,
          start_time,
          EXTRACT(EPOCH FROM (
            start_time - LAG(start_time) OVER (PARTITION BY machine_name ORDER BY start_time)
          )) / 60.0 AS minutes_since_last
        FROM downtime_records
        WHERE start_time >= NOW() - INTERVAL '${Math.min(days * 3, 365)} days'
      )
      SELECT
        machine_name,
        ROUND(AVG(minutes_since_last)::numeric, 1) AS avg_mtbf_minutes,
        COUNT(*) AS gap_count
      FROM ordered
      WHERE minutes_since_last IS NOT NULL
      GROUP BY machine_name
      HAVING COUNT(*) >= 1
      ORDER BY avg_mtbf_minutes ASC
      LIMIT 15
    `);

    const categoryRes = await pool.query(`
      SELECT
        COALESCE(category, 'other') AS category,
        COUNT(*) AS incidents,
        ROUND(SUM(duration_minutes)::numeric / 60.0, 2) AS total_hours
      FROM downtime_records
      WHERE start_time >= ${since}
      GROUP BY COALESCE(category, 'other')
      ORDER BY incidents DESC
    `);

    const trendRes = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('day', start_time), 'YYYY-MM-DD') AS day,
        COUNT(*) AS incidents,
        ROUND(SUM(duration_minutes)::numeric / 60.0, 2) AS total_hours
      FROM downtime_records
      WHERE start_time >= ${since}
      GROUP BY DATE_TRUNC('day', start_time)
      ORDER BY day
    `);

    const bottleneckRes = await pool.query(`
      SELECT
        machine_name,
        machine_code,
        COUNT(*) AS incidents,
        ROUND(SUM(duration_minutes)::numeric / 60.0, 2) AS total_downtime_hours,
        ROUND(AVG(CASE WHEN status = 'resolved' AND duration_minutes IS NOT NULL THEN duration_minutes END)::numeric / 60.0, 2) AS avg_mttr_hours,
        COUNT(CASE WHEN status = 'ongoing' THEN 1 END) AS open_incidents
      FROM downtime_records
      WHERE start_time >= ${since}
      GROUP BY machine_name, machine_code
      ORDER BY total_downtime_hours DESC
      LIMIT 10
    `);

    const oeeRes = await pool.query(`
      SELECT
        pl.id AS line_id,
        pl.name AS line_name,
        COALESCE(SUM(dr.duration_minutes), 0) AS downtime_minutes,
        pl.target_capacity_per_hour,
        COALESCE(SUM(ps.actual_capacity), 0) AS total_actual,
        COALESCE(SUM(ps.target_capacity), 0) AS total_target
      FROM production_lines pl
      LEFT JOIN downtime_records dr ON dr.line_id = pl.id AND dr.start_time >= ${since}
      LEFT JOIN production_records ps ON ps.line_id = pl.id AND ps.created_at >= ${since}
      WHERE pl.is_active = true
      GROUP BY pl.id, pl.name, pl.target_capacity_per_hour
    `);

    const lineDowntimeRes = await pool.query(`
      SELECT
        COALESCE(pl.name, dr.machine_name) AS line,
        COUNT(*) AS incidents,
        ROUND(SUM(dr.duration_minutes)::numeric / 60.0, 2) AS total_hours
      FROM downtime_records dr
      LEFT JOIN production_lines pl ON dr.line_id = pl.id
      WHERE dr.start_time >= ${since}
      GROUP BY COALESCE(pl.name, dr.machine_name)
      ORDER BY total_hours DESC
      LIMIT 10
    `);

    const brokenRes = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status IN ('reported', 'in_progress') THEN 1 END) AS open,
        COUNT(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 END) AS resolved,
        AVG(CASE WHEN (status = 'resolved' OR status = 'closed') AND resolved_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 3600.0 END) AS avg_repair_hours
      FROM broken_machines
      WHERE reported_at >= ${since}
    `);
    const br = brokenRes.rows[0];

    const minutesToHours = (m: string | number) => Math.round(parseFloat(String(m)) / 60 * 10) / 10;

    res.json({
      days,
      summary: {
        totalIncidents: parseInt(s.total_incidents, 10),
        totalDowntimeHours: minutesToHours(s.total_downtime_minutes),
        avgMttrHours: minutesToHours(s.avg_mttr_minutes),
        openIncidents: parseInt(s.open_incidents, 10),
      },
      mttrByMachine: mttrRes.rows.map(r => ({
        machine: r.machine_name,
        code: r.machine_code,
        incidents: parseInt(r.incidents, 10),
        avgMttrHours: minutesToHours(r.avg_mttr_minutes),
        totalDowntimeHours: minutesToHours(r.total_downtime_minutes),
      })),
      mtbfByMachine: mtbfRes.rows.map(r => ({
        machine: r.machine_name,
        avgMtbfHours: minutesToHours(r.avg_mtbf_minutes),
        gapCount: parseInt(r.gap_count, 10),
      })),
      downtimeByCategory: categoryRes.rows.map(r => ({
        category: r.category,
        incidents: parseInt(r.incidents, 10),
        totalHours: parseFloat(r.total_hours),
      })),
      downtimeTrend: trendRes.rows.map(r => ({
        day: r.day,
        incidents: parseInt(r.incidents, 10),
        totalHours: parseFloat(r.total_hours),
      })),
      bottlenecks: bottleneckRes.rows.map(r => ({
        machine: r.machine_name,
        code: r.machine_code,
        incidents: parseInt(r.incidents, 10),
        totalDowntimeHours: parseFloat(r.total_downtime_hours),
        avgMttrHours: r.avg_mttr_hours ? parseFloat(r.avg_mttr_hours) : null,
        openIncidents: parseInt(r.open_incidents, 10),
      })),
      oeeByLine: oeeRes.rows.map(r => {
        const downtimeMin = parseFloat(r.downtime_minutes);
        const totalActual = parseFloat(r.total_actual);
        const totalTarget = parseFloat(r.total_target);
        const availability = totalTarget > 0 ? Math.max(0, Math.round((1 - downtimeMin / (totalTarget > 0 ? totalTarget * 60 : 480)) * 100)) : null;
        const performance = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : null;
        const oee = availability !== null && performance !== null ? Math.round(availability * performance / 100) : null;
        return {
          lineId: parseInt(r.line_id),
          lineName: r.line_name,
          downtimeMinutes: downtimeMin,
          availability,
          performance,
          oee,
          totalActual,
          totalTarget,
        };
      }),
      downtimeByLine: lineDowntimeRes.rows.map(r => ({
        line: r.line,
        incidents: parseInt(r.incidents, 10),
        totalHours: parseFloat(r.total_hours),
      })),
      brokenMachines: {
        total: parseInt(br.total, 10),
        open: parseInt(br.open, 10),
        resolved: parseInt(br.resolved, 10),
        avgRepairHours: br.avg_repair_hours ? Math.round(parseFloat(br.avg_repair_hours) * 10) / 10 : null,
      },
    });
  } catch (err: any) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Analytics query failed", detail: err.message });
  }
});

export default router;
