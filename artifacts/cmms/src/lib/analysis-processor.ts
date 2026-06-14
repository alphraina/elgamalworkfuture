export interface RawRowData {
  LOT_ID: string;
  TEST_RESULT: string;
  TEST_TIME: string;
  PUSHED_AT?: string;
  RESULT_MSG: string;
  DEVICE: string;
  CYCLETIME: number;
}

export interface MachinePerformanceData {
  device: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  passRate: number;
  failRate: number;
  avgCycleTime: number;
  totalWorkingTimeMin: number;
  productivity: number;
  escapeCount: number;
  escapeRate: number;
  topError: string;
  topErrorPercentage: number;
  performanceScore: number;
  predictiveRiskScore: number;
  predictiveStatus: "Low Risk" | "Medium Risk" | "High Risk";
  oee: { availability: number; performance: number; quality: number; overall: number };
}

export interface PhoneFlow {
  lotId: string;
  attempts: number;
  finalResult: "PASS" | "FAIL";
  path: { device: string; result: string; time: string }[];
}

export interface DynamicBottleneck {
  timeWindow: string;
  worstMachine: string;
  reason: "Slow Cycle Time" | "Low Output" | "High Failure Rate";
  totalTests: number;
  avgCycleTime: number;
  failCount: number;
  score: number;
}

export interface HourlyTracerData {
  hour: string;
  device: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  failRate: number;
  uniquePhones: number;
}

export interface FlowMatrixRow {
  lotId: string;
  cells: Record<string, { result: "PASS" | "FAIL"; attempt: number } | null>;
  finalResult: "PASS" | "FAIL";
  attempts: number;
  firstFailDevice: string | null;
}

export interface FlowMatrix {
  deviceList: string[];
  rows: FlowMatrixRow[];
}

export interface CycleTimeSlot {
  bucket: string;
  count: number;
}

export interface ShiftData {
  shift: string;
  label: string;
  totalTests: number;
  passCount: number;
  failCount: number;
  passRate: number;
  uniquePhones: number;
  avgCycleTime: number;
}

export interface ParsedData {
  totalTested: number;
  uniquePhones: number;
  passCount: number;
  failCount: number;
  passRate: number;
  failRate: number;
  avgCycleTime: number;
  passByAttempt: { first: number; second: number; third: number; fourth: number; fifthPlus: number };
  totalNG: number;
  fpy: number;
  retestRate: number;
  passTrend: { date: string; pass: number; fail: number }[];
  errorDistribution: { name: string; count: number; percentage: number }[];
  machinePerformance: MachinePerformanceData[];
  failureHeatmap: { device: string; error: string; count: number }[];
  machineAnomalies: { device: string; passRate: number; avgCycleTime: number; escapeRate: number; riskScore: number; status: "GOOD" | "WARNING" | "CRITICAL" }[];
  productionFlow: PhoneFlow[];
  flowMatrix: FlowMatrix;
  dynamicBottlenecks: DynamicBottleneck[];
  hourlyTracer: HourlyTracerData[];
  hoursList: string[];
  devicesList: string[];
  cycleTimeDistribution: CycleTimeSlot[];
  shiftAnalysis: ShiftData[];
  rawData: RawRowData[];
}

export function calculateKPIs(data: RawRowData[]): ParsedData {
  const totalTested = data.length;
  let passCount = 0;
  let failCount = 0;
  let totalCycleTime = 0;

  const phoneHistory: Record<string, {
    attempts: number;
    passedOnAttempt: number | null;
    hasPass: boolean;
    path: { device: string; result: string; time: string }[];
    deviceResults: { device: string; result: "PASS" | "FAIL"; attempt: number }[];
  }> = {};

  const dateStrCounts: Record<string, { pass: number; fail: number }> = {};
  const errorCounts: Record<string, number> = {};

  const deviceStats: Record<string, {
    pass: number;
    fail: number;
    totalCycleTime: number;
    count: number;
    errors: Record<string, number>;
    escapedLots: Set<string>;
  }> = {};

  const phoneFails: Record<string, Set<string>> = {};

  const sortedData = [...data].sort(
    (a, b) => new Date(a.TEST_TIME).getTime() - new Date(b.TEST_TIME).getTime()
  );

  // Cycle time distribution bucketing
  const cycleBuckets: Record<string, number> = {};
  const shiftBuckets: Record<string, { total: number; pass: number; fail: number; cycleSum: number; phones: Set<string> }> = {};

  sortedData.forEach((row) => {
    const isPass = row.TEST_RESULT === "PASS";
    if (isPass) passCount++;
    else failCount++;
    totalCycleTime += row.CYCLETIME;

    // Phone journey
    if (!phoneHistory[row.LOT_ID]) {
      phoneHistory[row.LOT_ID] = { attempts: 0, passedOnAttempt: null, hasPass: false, path: [], deviceResults: [] };
    }
    const history = phoneHistory[row.LOT_ID];
    history.attempts++;
    history.path.push({ device: row.DEVICE, result: row.TEST_RESULT, time: row.TEST_TIME });
    history.deviceResults.push({ device: row.DEVICE, result: isPass ? "PASS" : "FAIL", attempt: history.attempts });
    if (isPass && !history.hasPass) {
      history.hasPass = true;
      history.passedOnAttempt = history.attempts;
    }

    // Date trend (use PUSHED_AT for correct day bucketing)
    try {
      const bucketTime = row.PUSHED_AT ?? row.TEST_TIME;
      const dateStr = new Date(bucketTime).toLocaleDateString();
      if (dateStr !== "Invalid Date") {
        if (!dateStrCounts[dateStr]) dateStrCounts[dateStr] = { pass: 0, fail: 0 };
        if (isPass) dateStrCounts[dateStr].pass++;
        else dateStrCounts[dateStr].fail++;
      }
    } catch {}

    // Error tracking
    if (!isPass && row.RESULT_MSG) {
      errorCounts[row.RESULT_MSG] = (errorCounts[row.RESULT_MSG] || 0) + 1;
    }

    // Device stats
    if (row.DEVICE) {
      if (!deviceStats[row.DEVICE]) {
        deviceStats[row.DEVICE] = { pass: 0, fail: 0, totalCycleTime: 0, count: 0, errors: {}, escapedLots: new Set() };
      }
      deviceStats[row.DEVICE].count++;
      deviceStats[row.DEVICE].totalCycleTime += row.CYCLETIME;
      if (isPass) {
        deviceStats[row.DEVICE].pass++;
        if (phoneFails[row.LOT_ID]) {
          phoneFails[row.LOT_ID].forEach((failDevice) => {
            if (failDevice !== row.DEVICE) deviceStats[failDevice]?.escapedLots.add(row.LOT_ID);
          });
        }
      } else {
        deviceStats[row.DEVICE].fail++;
        if (row.RESULT_MSG) {
          deviceStats[row.DEVICE].errors[row.RESULT_MSG] = (deviceStats[row.DEVICE].errors[row.RESULT_MSG] || 0) + 1;
        }
        if (!phoneFails[row.LOT_ID]) phoneFails[row.LOT_ID] = new Set();
        phoneFails[row.LOT_ID].add(row.DEVICE);
      }
    }

    // Cycle time distribution
    if (row.CYCLETIME > 0) {
      const ct = row.CYCLETIME;
      const bucketWidth = 5; // 5-second buckets
      const bucket = `${Math.floor(ct / bucketWidth) * bucketWidth}–${Math.floor(ct / bucketWidth) * bucketWidth + bucketWidth}s`;
      cycleBuckets[bucket] = (cycleBuckets[bucket] || 0) + 1;
    }

    // Shift analysis (use PUSHED_AT for shift bucketing)
    try {
      const bucketTime = row.PUSHED_AT ?? row.TEST_TIME;
      const d = new Date(bucketTime);
      const h = d.getHours();
      const shiftKey = h >= 6 && h < 14 ? "A" : h >= 14 && h < 22 ? "B" : "C";
      if (!shiftBuckets[shiftKey]) shiftBuckets[shiftKey] = { total: 0, pass: 0, fail: 0, cycleSum: 0, phones: new Set() };
      shiftBuckets[shiftKey].total++;
      if (isPass) shiftBuckets[shiftKey].pass++;
      else shiftBuckets[shiftKey].fail++;
      shiftBuckets[shiftKey].cycleSum += row.CYCLETIME;
      shiftBuckets[shiftKey].phones.add(row.LOT_ID);
    } catch {}
  });

  const uniquePhones = Object.keys(phoneHistory).length;
  let firstPass = 0, secondPass = 0, thirdPass = 0, fourthPass = 0, fifthPlusPass = 0, totalNG = 0;

  Object.values(phoneHistory).forEach((h) => {
    if (!h.hasPass) { totalNG++; return; }
    if (h.passedOnAttempt === 1) firstPass++;
    else if (h.passedOnAttempt === 2) secondPass++;
    else if (h.passedOnAttempt === 3) thirdPass++;
    else if (h.passedOnAttempt === 4) fourthPass++;
    else if (h.passedOnAttempt && h.passedOnAttempt >= 5) fifthPlusPass++;
  });

  const retested = Object.values(phoneHistory).filter((h) => h.attempts > 1).length;
  const fpy = uniquePhones > 0 ? (firstPass / uniquePhones) * 100 : 0;
  const retestRate = uniquePhones > 0 ? (retested / uniquePhones) * 100 : 0;

  const passTrend = Object.entries(dateStrCounts)
    .map(([date, c]) => ({ date, pass: c.pass, fail: c.fail }))
    .slice(-15);

  const errorDistribution = Object.entries(errorCounts)
    .map(([name, count]) => ({ name, count, percentage: failCount > 0 ? (count / failCount) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  const machinePerformance: MachinePerformanceData[] = Object.entries(deviceStats).map(([device, stats]) => {
    const totalTests = stats.count;
    const avgCycleTime = totalTests > 0 ? stats.totalCycleTime / totalTests : 0;
    const totalWorkingTimeMin = stats.totalCycleTime / 60;
    const productivity = totalWorkingTimeMin > 0 ? totalTests / totalWorkingTimeMin : 0;
    const escapeCount = stats.escapedLots.size;
    let topError = "", maxErrCount = 0;
    Object.entries(stats.errors).forEach(([msg, cnt]) => { if (cnt > maxErrCount) { maxErrCount = cnt; topError = msg; } });
    const topErrorPercentage = stats.fail > 0 ? (maxErrCount / stats.fail) * 100 : 0;
    const performanceScore = totalTests > 0 ? (1 - escapeCount / totalTests) * 100 : 0;
    return {
      device, totalTests, passCount: stats.pass, failCount: stats.fail,
      passRate: totalTests > 0 ? (stats.pass / totalTests) * 100 : 0,
      failRate: totalTests > 0 ? (stats.fail / totalTests) * 100 : 0,
      avgCycleTime, totalWorkingTimeMin, productivity, escapeCount,
      escapeRate: totalTests > 0 ? (escapeCount / totalTests) * 100 : 0,
      topError, topErrorPercentage, performanceScore,
      predictiveRiskScore: 0, predictiveStatus: "Low Risk" as const,
      oee: { availability: 0, performance: 0, quality: 0, overall: 0 },
    };
  }).sort((a, b) => b.performanceScore - a.performanceScore);

  // OEE & predictive risk
  let minCycleTime = Infinity, maxCycleTime = 0;
  let globalPassRateSum = 0, globalCycleTimeSum = 0, globalEscapeRateSum = 0;
  machinePerformance.forEach((m) => {
    globalPassRateSum += m.passRate;
    globalCycleTimeSum += m.avgCycleTime;
    globalEscapeRateSum += m.escapeRate;
    if (m.avgCycleTime > 0 && m.avgCycleTime < minCycleTime) minCycleTime = m.avgCycleTime;
    if (m.avgCycleTime > maxCycleTime) maxCycleTime = m.avgCycleTime;
  });
  if (minCycleTime === Infinity) minCycleTime = 1;
  const numMachines = machinePerformance.length;
  const avgCycleTimeGlobal = numMachines > 0 ? globalCycleTimeSum / numMachines : 0;
  const avgEscapeRate = numMachines > 0 ? globalEscapeRateSum / numMachines : 0;
  let maxPlanned = 0;
  machinePerformance.forEach((m) => { if (m.totalWorkingTimeMin > maxPlanned) maxPlanned = m.totalWorkingTimeMin; });

  machinePerformance.forEach((m) => {
    const normCycle = maxCycleTime > minCycleTime ? (m.avgCycleTime - minCycleTime) / (maxCycleTime - minCycleTime) : 0;
    const errFreq = m.failCount > 0 ? m.topErrorPercentage / 100 : 0;
    m.predictiveRiskScore = (m.failRate / 100) * 0.4 + normCycle * 0.2 + (m.escapeRate / 100) * 0.2 + errFreq * 0.2;
    m.predictiveStatus = m.predictiveRiskScore >= 0.6 ? "High Risk" : m.predictiveRiskScore >= 0.3 ? "Medium Risk" : "Low Risk";
    const availability = maxPlanned > 0 ? Math.min(1, m.totalWorkingTimeMin / maxPlanned) : 0;
    const operatingTimeSec = m.totalWorkingTimeMin * 60;
    const performance = operatingTimeSec > 0 ? Math.min(1, (minCycleTime * m.totalTests) / operatingTimeSec) : 0;
    const quality = m.totalTests > 0 ? m.passCount / m.totalTests : 0;
    m.oee = {
      availability: availability * 100,
      performance: performance * 100,
      quality: quality * 100,
      overall: availability * performance * quality * 100,
    };
  });

  const machineAnomalies = machinePerformance.map((m) => {
    const avgPassRate = numMachines > 0 ? globalPassRateSum / numMachines : 0;
    let riskScore = 0;
    if (m.passRate < avgPassRate) riskScore++;
    if (m.avgCycleTime > avgCycleTimeGlobal) riskScore++;
    if (m.escapeRate > avgEscapeRate) riskScore++;
    return {
      device: m.device, passRate: m.passRate, avgCycleTime: m.avgCycleTime,
      escapeRate: m.escapeRate, riskScore,
      status: riskScore >= 2 ? "CRITICAL" as const : riskScore === 1 ? "WARNING" as const : "GOOD" as const,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const failureHeatmap: { device: string; error: string; count: number }[] = [];
  Object.entries(deviceStats).forEach(([device, stats]) => {
    Object.entries(stats.errors).forEach(([error, count]) => {
      failureHeatmap.push({ device, error: error || "Unknown", count });
    });
  });
  failureHeatmap.sort((a, b) => b.count - a.count);

  const productionFlow: PhoneFlow[] = Object.entries(phoneHistory).map(([lotId, h]) => ({
    lotId, attempts: h.attempts,
    finalResult: h.hasPass ? "PASS" : "FAIL",
    path: h.path,
  }));

  // Production Flow Matrix — LOT × Machine cross-tabulation
  const allDevices = [...new Set(sortedData.map((r) => r.DEVICE).filter(Boolean))];
  const flowMatrixRows: FlowMatrixRow[] = Object.entries(phoneHistory).map(([lotId, h]) => {
    const cells: Record<string, { result: "PASS" | "FAIL"; attempt: number } | null> = {};
    allDevices.forEach((d) => { cells[d] = null; });
    const deviceAttemptCount: Record<string, number> = {};
    h.deviceResults.forEach(({ device, result }) => {
      if (!deviceAttemptCount[device]) deviceAttemptCount[device] = 0;
      deviceAttemptCount[device]++;
      if (!cells[device] || cells[device]!.result === "FAIL") {
        cells[device] = { result, attempt: deviceAttemptCount[device] };
      }
    });
    const firstFailDevice = h.path.find((p) => p.result !== "PASS")?.device ?? null;
    return { lotId, cells, finalResult: h.hasPass ? "PASS" : "FAIL", attempts: h.attempts, firstFailDevice };
  });
  flowMatrixRows.sort((a, b) => {
    if (a.finalResult !== b.finalResult) return a.finalResult === "FAIL" ? -1 : 1;
    return b.attempts - a.attempts;
  });

  // Dynamic Bottlenecks
  const timeWindows: Record<string, Record<string, { count: number; totalCycleTime: number; failCount: number }>> = {};
  sortedData.forEach((row) => {
    if (!row.DEVICE) return;
    try {
      const bucketTime = row.PUSHED_AT ?? row.TEST_TIME;
      const date = new Date(bucketTime);
      if (isNaN(date.getTime())) return;
      const tw = `${date.toLocaleDateString()} ${date.getHours().toString().padStart(2, "0")}:00`;
      if (!timeWindows[tw]) timeWindows[tw] = {};
      if (!timeWindows[tw][row.DEVICE]) timeWindows[tw][row.DEVICE] = { count: 0, totalCycleTime: 0, failCount: 0 };
      timeWindows[tw][row.DEVICE].count++;
      timeWindows[tw][row.DEVICE].totalCycleTime += row.CYCLETIME;
      if (row.TEST_RESULT !== "PASS") timeWindows[tw][row.DEVICE].failCount++;
    } catch {}
  });

  const dynamicBottlenecks: DynamicBottleneck[] = [];
  Object.entries(timeWindows).forEach(([timeWindow, devices]) => {
    const maxOutput = Math.max(...Object.values(devices).map((d) => d.count), 1);
    let worstMachine = "", maxScore = -1;
    let bottleneckReason: DynamicBottleneck["reason"] = "Low Output";
    let stats = { count: 0, cycleTime: 0, fail: 0 };
    Object.entries(devices).forEach(([device, d]) => {
      const avgCT = d.count > 0 ? d.totalCycleTime / d.count : 0;
      const failRate = d.count > 0 ? d.failCount / d.count : 0;
      const outputRatio = d.count / maxOutput;
      const ctFactor = avgCycleTimeGlobal > 0 ? avgCT / avgCycleTimeGlobal : 1;
      const score = (1 - outputRatio) * 40 + ctFactor * 40 + failRate * 20;
      if (score > maxScore) {
        maxScore = score; worstMachine = device;
        stats = { count: d.count, cycleTime: avgCT, fail: d.failCount };
        if ((1 - outputRatio) > (ctFactor - 1) && (1 - outputRatio) > failRate) bottleneckReason = "Low Output";
        else if ((ctFactor - 1) > failRate) bottleneckReason = "Slow Cycle Time";
        else bottleneckReason = "High Failure Rate";
      }
    });
    if (worstMachine) {
      dynamicBottlenecks.push({ timeWindow, worstMachine, reason: bottleneckReason, totalTests: stats.count, avgCycleTime: stats.cycleTime, failCount: stats.fail, score: maxScore });
    }
  });
  dynamicBottlenecks.sort((a, b) => new Date(a.timeWindow).getTime() - new Date(b.timeWindow).getTime());

  // Hourly Tracer (bucketed by pushed_at)
  const hourlyStats: Record<string, Record<string, { total: number; pass: number; fail: number; phones: Set<string> }>> = {};
  sortedData.forEach((row) => {
    if (!row.DEVICE) return;
    try {
      const bucketTime = row.PUSHED_AT ?? row.TEST_TIME;
      const date = new Date(bucketTime);
      if (isNaN(date.getTime())) return;
      const hourStr = `${date.toLocaleDateString()} ${date.getHours().toString().padStart(2, "0")}:00`;
      if (!hourlyStats[hourStr]) hourlyStats[hourStr] = {};
      if (!hourlyStats[hourStr][row.DEVICE]) hourlyStats[hourStr][row.DEVICE] = { total: 0, pass: 0, fail: 0, phones: new Set() };
      hourlyStats[hourStr][row.DEVICE].total++;
      if (row.TEST_RESULT === "PASS") hourlyStats[hourStr][row.DEVICE].pass++;
      else hourlyStats[hourStr][row.DEVICE].fail++;
      hourlyStats[hourStr][row.DEVICE].phones.add(row.LOT_ID);
    } catch {}
  });

  const hourlyTracer: HourlyTracerData[] = [];
  const hoursSet = new Set<string>();
  const devicesSet = new Set<string>();
  Object.entries(hourlyStats).forEach(([hour, devices]) => {
    hoursSet.add(hour);
    Object.entries(devices).forEach(([device, s]) => {
      devicesSet.add(device);
      hourlyTracer.push({
        hour, device,
        totalTests: s.total, passCount: s.pass, failCount: s.fail,
        failRate: s.total > 0 ? (s.fail / s.total) * 100 : 0,
        uniquePhones: s.phones.size,
      });
    });
  });

  // Cycle time distribution
  const cycleTimeDistribution: CycleTimeSlot[] = Object.entries(cycleBuckets)
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => {
      const aNum = parseInt(a.bucket);
      const bNum = parseInt(b.bucket);
      return aNum - bNum;
    });

  // Shift analysis
  const shiftLabels: Record<string, string> = { A: "Morning (06–14)", B: "Afternoon (14–22)", C: "Night (22–06)" };
  const shiftAnalysis: ShiftData[] = Object.entries(shiftBuckets).map(([shift, s]) => ({
    shift,
    label: shiftLabels[shift] ?? shift,
    totalTests: s.total,
    passCount: s.pass,
    failCount: s.fail,
    passRate: s.total > 0 ? (s.pass / s.total) * 100 : 0,
    uniquePhones: s.phones.size,
    avgCycleTime: s.total > 0 ? s.cycleSum / s.total : 0,
  })).sort((a, b) => a.shift.localeCompare(b.shift));

  const avgCycleTime = totalTested > 0 ? totalCycleTime / totalTested : 0;

  return {
    totalTested, uniquePhones, passCount, failCount,
    passRate: totalTested > 0 ? (passCount / totalTested) * 100 : 0,
    failRate: totalTested > 0 ? (failCount / totalTested) * 100 : 0,
    avgCycleTime,
    passByAttempt: { first: firstPass, second: secondPass, third: thirdPass, fourth: fourthPass, fifthPlus: fifthPlusPass },
    totalNG, fpy, retestRate,
    passTrend, errorDistribution, machinePerformance,
    failureHeatmap, machineAnomalies, productionFlow,
    flowMatrix: { deviceList: allDevices, rows: flowMatrixRows },
    dynamicBottlenecks, hourlyTracer,
    hoursList: Array.from(hoursSet).sort(),
    devicesList: Array.from(devicesSet),
    cycleTimeDistribution,
    shiftAnalysis,
    rawData: data,
  };
}
