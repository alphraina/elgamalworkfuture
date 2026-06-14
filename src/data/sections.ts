import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const sections = [
  {
    id: 'login',
    title: 'Secure Login',
    subtitle: 'Role-based access control for all factory personnel',
    image: '/artifacts/cmms-video/00-login.png',
    duration: 4000,
    cursorSequence: [
      { x: '50%', y: '60%', time: 1000 },
      { x: '50%', y: '60%', click: true, time: 2000 },
      { x: '50%', y: '70%', time: 2500 },
      { x: '50%', y: '70%', click: true, time: 3500 },
    ],
    zoom: 1,
  },
  {
    id: 'dashboard',
    title: 'Live Dashboard',
    subtitle: 'Real-time metrics, downtime alerts, and pending PMs',
    image: '/artifacts/cmms-video/01-dashboard.png',
    duration: 5000,
    cursorSequence: [
      { x: '20%', y: '30%', time: 1000 },
      { x: '80%', y: '40%', time: 3000 },
      { x: '10%', y: '50%', click: true, time: 4500 },
    ],
    zoom: 1.05,
    pan: { x: '0%', y: '5%' }
  },
  {
    id: 'downtime',
    title: 'Downtime Tracking',
    subtitle: 'Log and analyze machine failures instantly',
    image: '/artifacts/cmms-video/02-downtime.png',
    duration: 5000,
    cursorSequence: [
      { x: '90%', y: '15%', time: 1500 },
      { x: '90%', y: '15%', click: true, time: 2000 }, // Clicking "Record Downtime"
      { x: '50%', y: '50%', time: 3500 },
    ],
    zoom: 1,
  },
  {
    id: 'downtime-dialog',
    title: 'Record Incident',
    subtitle: 'Quick reporting with category and reason codes',
    image: '/artifacts/cmms-video/17-downtime-dialog.png',
    duration: 4000,
    cursorSequence: [
      { x: '40%', y: '40%', time: 1000 },
      { x: '60%', y: '70%', click: true, time: 3000 },
    ],
    zoom: 1.1,
  },
  {
    id: 'inventory',
    title: 'Spare Parts Inventory',
    subtitle: 'Track stock levels and automated low-stock alerts',
    image: '/artifacts/cmms-video/03-inventory.png',
    duration: 4500,
    cursorSequence: [
      { x: '30%', y: '40%', time: 1500 },
      { x: '80%', y: '20%', click: true, time: 3500 },
    ],
    zoom: 1,
  },
  {
    id: 'orders',
    title: 'Parts Requisition',
    subtitle: 'Technicians request parts, inventory approves',
    image: '/artifacts/cmms-video/04-orders.png',
    duration: 4000,
    cursorSequence: [
      { x: '70%', y: '50%', time: 2000 },
      { x: '70%', y: '50%', click: true, time: 3000 },
    ],
    zoom: 1.05,
  },
  {
    id: 'pm-calendar',
    title: 'PM Calendar',
    subtitle: 'Preventive maintenance scheduling and workload balancing',
    image: '/artifacts/cmms-video/05-pm-calendar.png',
    duration: 5000,
    cursorSequence: [
      { x: '40%', y: '30%', time: 1000 },
      { x: '60%', y: '60%', click: true, time: 3500 },
    ],
    zoom: 1.1,
    pan: { x: '-5%', y: '-5%' }
  },
  {
    id: 'training',
    title: 'Team Training',
    subtitle: 'Continuous learning, courses, and certifications',
    image: '/artifacts/cmms-video/06-training.png',
    duration: 4000,
    cursorSequence: [
      { x: '85%', y: '30%', click: true, time: 2000 },
    ],
    zoom: 1,
  },
  {
    id: 'kpi',
    title: 'KPI Scorecards',
    subtitle: 'Performance metrics for every team member',
    image: '/artifacts/cmms-video/07-kpi.png',
    duration: 4500,
    cursorSequence: [
      { x: '50%', y: '50%', time: 2000 },
    ],
    zoom: 1.15,
    pan: { x: '0%', y: '10%' }
  },
  {
    id: 'attendance',
    title: 'Attendance Board',
    subtitle: 'Daily check-in and shift management grid',
    image: '/artifacts/cmms-video/08-attendance.png',
    duration: 4000,
    cursorSequence: [
      { x: '20%', y: '40%', time: 1000 },
      { x: '80%', y: '40%', time: 3000 },
    ],
    zoom: 1,
  },
  {
    id: 'machines',
    title: 'Machine Registry',
    subtitle: 'Comprehensive equipment database with QR codes',
    image: '/artifacts/cmms-video/09-machines.png',
    duration: 4500,
    cursorSequence: [
      { x: '90%', y: '25%', click: true, time: 2500 },
    ],
    zoom: 1.05,
  },
  {
    id: 'changeover',
    title: 'Production Changeover',
    subtitle: 'Track mode transitions and cylinder changes',
    image: '/artifacts/cmms-video/10-changeover.png',
    duration: 4000,
    cursorSequence: [
      { x: '50%', y: '30%', time: 1500 },
      { x: '50%', y: '30%', click: true, time: 2500 },
    ],
    zoom: 1.1,
  },
  {
    id: 'defects',
    title: 'Quality Control',
    subtitle: 'Log and resolve product defects quickly',
    image: '/artifacts/cmms-video/11-defects.png',
    duration: 4000,
    cursorSequence: [
      { x: '30%', y: '60%', time: 2000 },
    ],
    zoom: 1,
  },
  {
    id: 'broken-machines',
    title: 'Repair Requests',
    subtitle: 'Prioritize and dispatch broken machine fixes',
    image: '/artifacts/cmms-video/12-broken-machines.png',
    duration: 4000,
    cursorSequence: [
      { x: '80%', y: '45%', click: true, time: 2000 },
    ],
    zoom: 1.05,
  },
  {
    id: 'users',
    title: 'User Management',
    subtitle: 'Administer roles, permissions, and teams',
    image: '/artifacts/cmms-video/13-users.png',
    duration: 4000,
    cursorSequence: [
      { x: '70%', y: '20%', click: true, time: 2000 },
    ],
    zoom: 1,
  },
  {
    id: 'settings',
    title: 'Factory Customization',
    subtitle: 'Tailor the CMMS to your specific factory layout',
    image: '/artifacts/cmms-video/14-factory-settings.png',
    duration: 4000,
    cursorSequence: [
      { x: '20%', y: '50%', time: 2000 },
    ],
    zoom: 1.1,
  },
  {
    id: 'help',
    title: 'Help & Guides',
    subtitle: 'Built-in video tutorials and documentation',
    image: '/artifacts/cmms-video/15-help.png',
    duration: 5000,
    cursorSequence: [
      { x: '50%', y: '40%', click: true, time: 2500 },
    ],
    zoom: 1,
  }
];

export const TOTAL_DURATION = sections.reduce((acc, s) => acc + s.duration, 0);

// We'll create a generic scene component in the App.tsx
