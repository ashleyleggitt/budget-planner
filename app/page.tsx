"use client";

import React, { useEffect, useMemo, useState } from "react";

type TabKey = "bills" | "budget" | "calendar";

type BillItem = {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  recurring: boolean;
};

type IncomeItem = {
  id: string;
  label: string;
  amount: number;
};

type SavingsBucket = {
  id: string;
  name: string;
  current: number;
  target: number;
};

type GoalItem = {
  id: string;
  text: string;
};

type CalendarEntries = Record<string, string[]>;

type MonthData = {
  bills: BillItem[];
  incomes: IncomeItem[];
  buckets: SavingsBucket[];
  goals: GoalItem[];
  notes: string;
  calendarEntries: CalendarEntries;
};

type AppData = Record<string, MonthData>;

type CalendarCell = {
  dayNumber: number;
  dateKey: string;
} | null;

const STORAGE_KEY = "budget-planner-mobile-v1";
const PASSWORD_STORAGE_KEY = "budget-planner-unlocked";
const APP_PASSWORD = "ashley123"; // change if you want

const COLORS = {
  bg: "#f8f6f1",
  panel: "#ffffff",
  gold: "#e9deb2",
  goldDark: "#cfbf84",
  goldBorder: "#e7dcc0",
  text: "#2f2b24",
  subtext: "#70685d",
  shadow: "0 4px 16px rgba(0,0,0,0.03)",
  danger: "#b75b5b",
  dangerBg: "#fff5f5",
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyMonthData(): MonthData {
  return {
    bills: [],
    incomes: [],
    buckets: [],
    goals: [],
    notes: "",
    calendarEntries: {},
  };
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(monthKey: string, delta: number) {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(year, month - 1 + delta, 1);
  return formatMonthKey(shifted);
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildCalendarCells(monthKey: string): CalendarCell[] {
  const { year, month } = parseMonthKey(monthKey);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = firstDay.getDay();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dayNumber: day,
      dateKey: `${monthKey}-${String(day).padStart(2, "0")}`,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function cloneRecurringBillsForward(data: AppData, targetMonth: string): AppData {
  if (data[targetMonth]) return data;

  const prevMonth = shiftMonth(targetMonth, -1);
  const prevData = data[prevMonth];

  if (!prevData) {
    return {
      ...data,
      [targetMonth]: emptyMonthData(),
    };
  }

  const recurringBills = prevData.bills
    .filter((bill) => bill.recurring)
    .map((bill) => ({
      ...bill,
      id: createId(),
      paid: false,
    }));

  return {
    ...data,
    [targetMonth]: {
      ...emptyMonthData(),
      bills: recurringBills,
    },
  };
}

export default function Page() {
  const initialMonth = formatMonthKey(new Date());

  const [mounted, setMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [activeTab, setActiveTab] = useState<TabKey>("bills");
  const [currentMonthKey, setCurrentMonthKey] = useState(initialMonth);
  const [appData, setAppData] = useState<AppData>({
    [initialMonth]: emptyMonthData(),
  });

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billRecurring, setBillRecurring] = useState(false);

  const [incomeLabel, setIncomeLabel] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const [bucketName, setBucketName] = useState("");
  const [bucketCurrent, setBucketCurrent] = useState("");
  const [bucketTarget, setBucketTarget] = useState("");

  const [goalText, setGoalText] = useState("");

  const [selectedCalendarDay, setSelectedCalendarDay] = useState(`${initialMonth}-01`);
  const [calendarInput, setCalendarInput] = useState("");

  useEffect(() => {
    setMounted(true);

    try {
      const unlocked = window.localStorage.getItem(PASSWORD_STORAGE_KEY);
      if (unlocked === "true") {
        setIsUnlocked(true);
      }

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as AppData;
      const hydrated = cloneRecurringBillsForward(parsed, initialMonth);

      if (!hydrated[initialMonth]) {
        hydrated[initialMonth] = emptyMonthData();
      }

      setAppData(hydrated);
    } catch {
      // keep defaults
    }
  }, [initialMonth]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData, mounted]);

  useEffect(() => {
    setAppData((prev) => cloneRecurringBillsForward(prev, currentMonthKey));
    setSelectedCalendarDay(`${currentMonthKey}-01`);
  }, [currentMonthKey]);

  function handleUnlock() {
    if (passwordInput === APP_PASSWORD) {
      setIsUnlocked(true);
      setPasswordError("");
      window.localStorage.setItem(PASSWORD_STORAGE_KEY, "true");
    } else {
      setPasswordError("Incorrect password");
    }
  }

  function handleLogout() {
    setIsUnlocked(false);
    setPasswordInput("");
    window.localStorage.removeItem(PASSWORD_STORAGE_KEY);
  }

  const monthData = appData[currentMonthKey] ?? emptyMonthData();
  const unpaidBills = monthData.bills.filter((bill) => !bill.paid);
  const paidBills = monthData.bills.filter((bill) => bill.paid);

  const plannedBillsTotal = monthData.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const paidBillsTotal = paidBills.reduce((sum, bill) => sum + bill.amount, 0);
  const remainingBillsTotal = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
  const incomeTotal = monthData.incomes.reduce((sum, item) => sum + item.amount, 0);
  const savingsTotal = monthData.buckets.reduce((sum, item) => sum + item.current, 0);

  const calendarCells = useMemo(() => buildCalendarCells(currentMonthKey), [currentMonthKey]);
  const selectedEntries = selectedCalendarDay
    ? monthData.calendarEntries[selectedCalendarDay] ?? []
    : [];

  function updateMonthData(updater: (existing: MonthData) => MonthData) {
    setAppData((prev) => {
      const ensured = cloneRecurringBillsForward(prev, currentMonthKey);
      const existing = ensured[currentMonthKey] ?? emptyMonthData();

      return {
        ...ensured,
        [currentMonthKey]: updater(existing),
      };
    });
  }

  function goToPreviousMonth() {
    setCurrentMonthKey((prev) => shiftMonth(prev, -1));
  }

  function goToNextMonth() {
    setCurrentMonthKey((prev) => shiftMonth(prev, 1));
  }

  function addBill() {
    if (!billName.trim()) return;

    updateMonthData((existing) => ({
      ...existing,
      bills: [
        ...existing.bills,
        {
          id: createId(),
          name: billName.trim(),
          amount: Number(billAmount) || 0,
          paid: false,
          recurring: billRecurring,
        },
      ],
    }));

    setBillName("");
    setBillAmount("");
    setBillRecurring(false);
  }

  function toggleBillPaid(id: string) {
    updateMonthData((existing) => ({
      ...existing,
      bills: existing.bills.map((bill) =>
        bill.id === id ? { ...bill, paid: !bill.paid } : bill
      ),
    }));
  }

  function deleteBill(id: string) {
    updateMonthData((existing) => ({
      ...existing,
      bills: existing.bills.filter((bill) => bill.id !== id),
    }));
  }

  function addIncome() {
    if (!incomeLabel.trim()) return;

    updateMonthData((existing) => ({
      ...existing,
      incomes: [
        ...existing.incomes,
        {
          id: createId(),
          label: incomeLabel.trim(),
          amount: Number(incomeAmount) || 0,
        },
      ],
    }));

    setIncomeLabel("");
    setIncomeAmount("");
  }

  function deleteIncome(id: string) {
    updateMonthData((existing) => ({
      ...existing,
      incomes: existing.incomes.filter((income) => income.id !== id),
    }));
  }

  function addBucket() {
    if (!bucketName.trim()) return;

    updateMonthData((existing) => ({
      ...existing,
      buckets: [
        ...existing.buckets,
        {
          id: createId(),
          name: bucketName.trim(),
          current: Number(bucketCurrent) || 0,
          target: Number(bucketTarget) || 0,
        },
      ],
    }));

    setBucketName("");
    setBucketCurrent("");
    setBucketTarget("");
  }

  function deleteBucket(id: string) {
    updateMonthData((existing) => ({
      ...existing,
      buckets: existing.buckets.filter((bucket) => bucket.id !== id),
    }));
  }

  function addGoal() {
    if (!goalText.trim()) return;

    updateMonthData((existing) => ({
      ...existing,
      goals: [...existing.goals, { id: createId(), text: goalText.trim() }],
    }));

    setGoalText("");
  }

  function deleteGoal(id: string) {
    updateMonthData((existing) => ({
      ...existing,
      goals: existing.goals.filter((goal) => goal.id !== id),
    }));
  }

  function addCalendarEntry() {
    if (!selectedCalendarDay || !calendarInput.trim()) return;

    updateMonthData((existing) => ({
      ...existing,
      calendarEntries: {
        ...existing.calendarEntries,
        [selectedCalendarDay]: [
          ...(existing.calendarEntries[selectedCalendarDay] ?? []),
          calendarInput.trim(),
        ],
      },
    }));

    setCalendarInput("");
  }

  function deleteCalendarEntry(indexToDelete: number) {
    if (!selectedCalendarDay) return;

    updateMonthData((existing) => {
      const currentEntries = existing.calendarEntries[selectedCalendarDay] ?? [];
      const updatedEntries = currentEntries.filter((_, index) => index !== indexToDelete);

      const nextCalendarEntries = { ...existing.calendarEntries };

      if (updatedEntries.length === 0) {
        delete nextCalendarEntries[selectedCalendarDay];
      } else {
        nextCalendarEntries[selectedCalendarDay] = updatedEntries;
      }

      return {
        ...existing,
        calendarEntries: nextCalendarEntries,
      };
    });
  }

  function updateMonthNotes(value: string) {
    updateMonthData((existing) => ({
      ...existing,
      notes: value,
    }));
  }

  const styles: Record<string, React.CSSProperties> = {
    shell: {
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      padding: "20px 16px 36px",
      maxWidth: 430,
      margin: "0 auto",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    gateShell: {
      minHeight: "100vh",
      background: COLORS.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Inter, system-ui, sans-serif",
    },
    gateCard: {
      width: "100%",
      maxWidth: 420,
      background: COLORS.panel,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 24,
      padding: 24,
      boxShadow: COLORS.shadow,
    },
    gateTitle: {
      fontSize: 28,
      fontWeight: 800,
      textAlign: "center",
      marginBottom: 8,
      color: COLORS.text,
    },
    gateSub: {
      fontSize: 14,
      color: COLORS.subtext,
      textAlign: "center",
      lineHeight: 1.5,
      marginBottom: 18,
    },
    gateError: {
      marginTop: 10,
      color: "#a94442",
      fontSize: 14,
      textAlign: "center",
    },
    topTitle: {
      textAlign: "center",
      fontSize: 26,
      fontWeight: 800,
      marginBottom: 18,
      letterSpacing: -0.4,
    },
    monthSwitcher: {
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 14,
      marginBottom: 16,
    },
    monthButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      border: `1px solid ${COLORS.goldDark}`,
      background: COLORS.gold,
      color: COLORS.text,
      fontSize: 28,
      lineHeight: 1,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: COLORS.shadow,
    },
    monthLabel: {
      minWidth: 210,
      textAlign: "center",
      background: COLORS.panel,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 22,
      padding: "14px 20px",
      fontSize: 18,
      fontWeight: 800,
      boxShadow: COLORS.shadow,
    },
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 14,
      marginBottom: 16,
    },
    statCard: {
      background: COLORS.panel,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 22,
      padding: 18,
      minHeight: 110,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: COLORS.shadow,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: COLORS.subtext,
    },
    statValue: {
      fontSize: 26,
      fontWeight: 800,
    },
    tabs: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      flexWrap: "nowrap",
      marginBottom: 18,
    },
    tab: {
      border: "1px solid #38342e",
      background: COLORS.panel,
      color: COLORS.text,
      borderRadius: 18,
      padding: "12px 16px",
      fontWeight: 700,
      fontSize: 15,
      cursor: "pointer",
      whiteSpace: "nowrap",
      textAlign: "center",
    },
    activeTab: {
      border: `1px solid ${COLORS.goldDark}`,
      background: COLORS.gold,
      color: COLORS.text,
      borderRadius: 18,
      padding: "12px 16px",
      fontWeight: 800,
      fontSize: 15,
      cursor: "pointer",
      whiteSpace: "nowrap",
      textAlign: "center",
    },
    stack: {
      display: "grid",
      gap: 16,
    },
    panel: {
      background: COLORS.panel,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 24,
      padding: 18,
      boxShadow: COLORS.shadow,
    },
    panelTitle: {
      fontSize: 18,
      fontWeight: 800,
      marginBottom: 8,
    },
    panelSub: {
      fontSize: 14,
      color: COLORS.subtext,
      lineHeight: 1.45,
      marginBottom: 14,
    },
    sectionDividerRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    sectionDivider: {
      height: 1,
      background: COLORS.goldBorder,
      flex: 1,
    },
    sectionDividerText: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 1,
      color: COLORS.subtext,
    },
    inputRow: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      marginBottom: 14,
    },
    input: {
      width: "100%",
      border: `1px solid ${COLORS.goldBorder}`,
      background: "#fffdfa",
      borderRadius: 18,
      padding: "14px 16px",
      fontSize: 16,
      color: COLORS.text,
      outline: "none",
    },
    primaryButton: {
      border: `1px solid ${COLORS.goldDark}`,
      background: COLORS.gold,
      color: COLORS.text,
      borderRadius: 18,
      padding: "14px 22px",
      fontWeight: 800,
      fontSize: 16,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    logoutRow: {
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: 14,
    },
    billsInputGrid: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr",
      gap: 10,
      marginBottom: 14,
    },
    bucketInputGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 14,
    },
    checkboxWrap: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: COLORS.subtext,
      paddingLeft: 4,
      fontSize: 14,
    },
    totalsCard: {
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 22,
      padding: 16,
      background: "#fffdfa",
      marginTop: 2,
    },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      fontSize: 16,
    },
    listStack: {
      display: "grid",
      gap: 10,
    },
    listItem: {
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      padding: "12px 14px",
      background: "#fffdfa",
      fontSize: 15,
    },
    listItemRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      padding: "12px 14px",
      background: "#fffdfa",
      fontSize: 15,
      gap: 12,
    },
    billRow: {
      display: "grid",
      gridTemplateColumns: "20px 1fr auto",
      alignItems: "start",
      gap: 12,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      padding: "13px 14px",
      background: "#fffdfa",
      cursor: "pointer",
    },
    billRowPaid: {
      display: "grid",
      gridTemplateColumns: "20px 1fr auto",
      alignItems: "start",
      gap: 12,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      padding: "13px 14px",
      background: "#f6f2e8",
      opacity: 0.82,
      cursor: "pointer",
    },
    billTextWrap: {
      display: "grid",
      gap: 4,
    },
    billName: {
      fontSize: 15,
      fontWeight: 700,
    },
    billMeta: {
      fontSize: 13,
      color: COLORS.subtext,
    },
    detailsBox: {
      marginTop: 14,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      overflow: "hidden",
      background: "#fffdfa",
    },
    summaryLine: {
      listStyle: "none",
      cursor: "pointer",
      padding: "14px 16px",
      fontWeight: 800,
    },
    detailsContent: {
      display: "grid",
      gap: 10,
      padding: "0 14px 14px",
    },
    celebrationBox: {
      marginTop: 14,
      background: "#f5efd5",
      border: `1px solid ${COLORS.goldDark}`,
      color: COLORS.text,
      borderRadius: 18,
      padding: "14px 16px",
      fontWeight: 800,
      textAlign: "center",
    },
    smallHeading: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 1.2,
      color: COLORS.subtext,
      textAlign: "center",
      marginTop: 18,
      marginBottom: 12,
    },
    bucketCard: {
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      padding: 14,
      background: "#fffdfa",
      display: "grid",
      gap: 10,
    },
    progressTrack: {
      width: "100%",
      height: 10,
      background: "#f1ece1",
      borderRadius: 999,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      background: COLORS.goldDark,
      borderRadius: 999,
    },
    weekdayRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
      marginBottom: 10,
    },
    weekdayLabel: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: 800,
      color: COLORS.subtext,
      letterSpacing: 1,
    },
    calendarGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
      gap: 8,
    },
    calendarCell: {
      minHeight: 92,
      border: `1px solid ${COLORS.goldBorder}`,
      borderRadius: 18,
      background: "#fffdfa",
      padding: 8,
      textAlign: "left",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
    },
    calendarCellEmpty: {
      opacity: 0.45,
      borderStyle: "dashed",
      cursor: "default",
      background: "#faf7ef",
    },
    calendarCellSelected: {
      background: "#f5efd5",
      border: `1px solid ${COLORS.goldDark}`,
    },
    calendarCellDate: {
      fontSize: 14,
      fontWeight: 800,
      marginBottom: 6,
    },
    calendarCellPreview: {
      display: "grid",
      gap: 4,
    },
    calendarPreviewLine: {
      fontSize: 10,
      color: COLORS.subtext,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    notesArea: {
      width: "100%",
      minHeight: 140,
      border: `1px solid ${COLORS.goldBorder}`,
      background: "#fffdfa",
      borderRadius: 18,
      padding: 16,
      fontSize: 16,
      color: COLORS.text,
      resize: "vertical",
      outline: "none",
      fontFamily: "Inter, system-ui, sans-serif",
      lineHeight: 1.5,
    },
    emptyText: {
      color: COLORS.subtext,
      fontSize: 15,
      lineHeight: 1.45,
    },
    deleteButton: {
      border: `1px solid #e7caca`,
      background: COLORS.dangerBg,
      color: COLORS.danger,
      borderRadius: 12,
      padding: "8px 10px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      alignSelf: "center",
      whiteSpace: "nowrap",
    },
    itemWithDelete: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      alignItems: "center",
    },
  };

  function renderBillsTab() {
    return (
      <div style={styles.stack}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Month Overview</div>
          <div style={styles.panelSub}>{monthLabelFromKey(currentMonthKey)}</div>

          <div style={styles.sectionDividerRow}>
            <div style={styles.sectionDivider} />
            <div style={styles.sectionDividerText}>GOALS</div>
            <div style={styles.sectionDivider} />
          </div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="e.g. Save $1,000 · Spend less eating out"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
            />
            <button style={styles.primaryButton} onClick={addGoal}>
              Add
            </button>
          </div>

          {monthData.goals.length === 0 ? (
            <div style={styles.emptyText}>No goals yet.</div>
          ) : (
            <div style={styles.listStack}>
              {monthData.goals.map((goal) => (
                <div key={goal.id} style={styles.listItem}>
                  <div style={styles.itemWithDelete}>
                    <span>{goal.text}</span>
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={() => deleteGoal(goal.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Bills Checklist</div>
          <div style={styles.panelSub}>Bills do not require dates. Amounts optional.</div>

          <div style={styles.billsInputGrid}>
            <input
              style={styles.input}
              placeholder="Rent, phone, internet..."
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
            />
            <input
              style={styles.input}
              inputMode="decimal"
              placeholder="$ (optional)"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
            <label style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={billRecurring}
                onChange={(e) => setBillRecurring(e.target.checked)}
              />
              recurring
            </label>
            <button style={styles.primaryButton} onClick={addBill}>
              Add
            </button>
          </div>

          <div style={styles.totalsCard}>
            <div style={styles.totalRow}>
              <span>Planned</span>
              <strong>{money(plannedBillsTotal)}</strong>
            </div>
            <div style={styles.totalRow}>
              <span>Paid</span>
              <strong>{money(paidBillsTotal)}</strong>
            </div>
            <div style={styles.totalRow}>
              <span>Remaining</span>
              <strong>{money(remainingBillsTotal)}</strong>
            </div>
          </div>

          <div style={styles.smallHeading}>UNPAID BILLS</div>

          {unpaidBills.length === 0 ? (
            <div style={styles.emptyText}>No unpaid bills.</div>
          ) : (
            <div style={styles.listStack}>
              {unpaidBills.map((bill) => (
                <label key={bill.id} style={styles.billRow}>
                  <input
                    type="checkbox"
                    checked={bill.paid}
                    onChange={() => toggleBillPaid(bill.id)}
                  />
                  <div style={styles.billTextWrap}>
                    <div style={styles.billName}>{bill.name}</div>
                    <div style={styles.billMeta}>
                      {bill.amount ? money(bill.amount) : "No amount"}
                      {bill.recurring ? " · recurring" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={styles.deleteButton}
                    onClick={(e) => {
                      e.preventDefault();
                      deleteBill(bill.id);
                    }}
                  >
                    Delete
                  </button>
                </label>
              ))}
            </div>
          )}

          <details style={styles.detailsBox}>
            <summary style={styles.summaryLine}>Paid Bills ({paidBills.length})</summary>
            <div style={styles.detailsContent}>
              {paidBills.length === 0 ? (
                <div style={styles.emptyText}>No paid bills yet.</div>
              ) : (
                paidBills.map((bill) => (
                  <label key={bill.id} style={styles.billRowPaid}>
                    <input
                      type="checkbox"
                      checked={bill.paid}
                      onChange={() => toggleBillPaid(bill.id)}
                    />
                    <div style={styles.billTextWrap}>
                      <div style={styles.billName}>{bill.name}</div>
                      <div style={styles.billMeta}>
                        {bill.amount ? money(bill.amount) : "No amount"}
                        {bill.recurring ? " · recurring" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={(e) => {
                        e.preventDefault();
                        deleteBill(bill.id);
                      }}
                    >
                      Delete
                    </button>
                  </label>
                ))
              )}
            </div>
          </details>

          {unpaidBills.length === 0 && monthData.bills.length > 0 ? (
            <div style={styles.celebrationBox}>
              ✨ All bills paid for {monthLabelFromKey(currentMonthKey)}!
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBudgetTab() {
    return (
      <div style={styles.stack}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Income</div>
          <div style={styles.panelSub}>Track monthly income entries.</div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Paycheck, side income..."
              value={incomeLabel}
              onChange={(e) => setIncomeLabel(e.target.value)}
            />
            <input
              style={styles.input}
              inputMode="decimal"
              placeholder="$ amount"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
            />
            <button style={styles.primaryButton} onClick={addIncome}>
              Add
            </button>
          </div>

          {monthData.incomes.length === 0 ? (
            <div style={styles.emptyText}>None yet.</div>
          ) : (
            <div style={styles.listStack}>
              {monthData.incomes.map((income) => (
                <div key={income.id} style={styles.listItemRow}>
                  <span>{income.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong>{money(income.amount)}</strong>
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={() => deleteIncome(income.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Savings Buckets</div>
          <div style={styles.panelSub}>Track progress toward simple savings goals.</div>

          <div style={styles.bucketInputGrid}>
            <input
              style={styles.input}
              placeholder="Emergency fund"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
            />
            <input
              style={styles.input}
              inputMode="decimal"
              placeholder="$ current"
              value={bucketCurrent}
              onChange={(e) => setBucketCurrent(e.target.value)}
            />
            <input
              style={styles.input}
              inputMode="decimal"
              placeholder="$ target"
              value={bucketTarget}
              onChange={(e) => setBucketTarget(e.target.value)}
            />
            <button style={styles.primaryButton} onClick={addBucket}>
              Add
            </button>
          </div>

          {monthData.buckets.length === 0 ? (
            <div style={styles.emptyText}>None yet.</div>
          ) : (
            <div style={styles.listStack}>
              {monthData.buckets.map((bucket) => {
                const progress =
                  bucket.target > 0
                    ? Math.min(100, (bucket.current / bucket.target) * 100)
                    : 0;

                return (
                  <div key={bucket.id} style={styles.bucketCard}>
                    <div style={styles.listItemRow}>
                      <span>{bucket.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <strong>
                          {money(bucket.current)} / {money(bucket.target)}
                        </strong>
                        <button
                          type="button"
                          style={styles.deleteButton}
                          onClick={() => deleteBucket(bucket.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCalendarTab() {
    return (
      <div style={styles.stack}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Calendar</div>
          <div style={styles.panelSub}>
            Add work shifts, appointments, deadlines, or reminders for each day.
          </div>

          <div style={styles.weekdayRow}>
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
              <div key={day} style={styles.weekdayLabel}>
                {day}
              </div>
            ))}
          </div>

          <div style={styles.calendarGrid}>
            {calendarCells.map((cell, index) => {
              const isEmpty = !cell;
              const isSelected = cell?.dateKey === selectedCalendarDay;
              const preview = cell ? monthData.calendarEntries[cell.dateKey] ?? [] : [];

              return (
                <button
                  key={cell?.dateKey ?? `empty-${index}`}
                  type="button"
                  disabled={isEmpty}
                  onClick={() => {
                    if (cell) setSelectedCalendarDay(cell.dateKey);
                  }}
                  style={{
                    ...styles.calendarCell,
                    ...(isEmpty ? styles.calendarCellEmpty : {}),
                    ...(isSelected ? styles.calendarCellSelected : {}),
                  }}
                >
                  {cell ? (
                    <>
                      <div style={styles.calendarCellDate}>{cell.dayNumber}</div>
                      <div style={styles.calendarCellPreview}>
                        {preview.slice(0, 2).map((entry, i) => (
                          <div key={i} style={styles.calendarPreviewLine}>
                            {entry}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Selected Day: {selectedCalendarDay}</div>
          <div style={styles.panelSub}>
            Add short notes like work, appointment, payday, or project due.
          </div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Add entry..."
              value={calendarInput}
              onChange={(e) => setCalendarInput(e.target.value)}
            />
            <button style={styles.primaryButton} onClick={addCalendarEntry}>
              Add
            </button>
          </div>

          {selectedEntries.length === 0 ? (
            <div style={styles.emptyText}>No entries for this day yet.</div>
          ) : (
            <div style={styles.listStack}>
              {selectedEntries.map((entry, index) => (
                <div key={`${selectedCalendarDay}-${index}`} style={styles.listItem}>
                  <div style={styles.itemWithDelete}>
                    <span>{entry}</span>
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={() => deleteCalendarEntry(index)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Month Notes</div>
          <textarea
            style={styles.notesArea}
            placeholder="Month notes, payday reminders, work schedule, project notes, or anything you want to remember..."
            value={monthData.notes}
            onChange={(e) => updateMonthNotes(e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ background: COLORS.bg, minHeight: "100vh" }} />;
  }

  if (!isUnlocked) {
    return (
      <div style={styles.gateShell}>
        <div style={styles.gateCard}>
          <div style={styles.gateTitle}>Budget Tracker</div>
          <div style={styles.gateSub}>Enter your password to open the app.</div>

          <input
            type="password"
            style={styles.input}
            placeholder="Enter password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUnlock();
            }}
          />

          <div style={{ marginTop: 14 }}>
            <button style={{ ...styles.primaryButton, width: "100%" }} onClick={handleUnlock}>
              Unlock
            </button>
          </div>

          {passwordError ? <div style={styles.gateError}>{passwordError}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <div style={styles.logoutRow}>
        <button style={styles.deleteButton} onClick={handleLogout}>
          Lock App
        </button>
      </div>

      <div style={styles.topTitle}>Bill Reminder + Budget Tracker</div>

      <div style={styles.monthSwitcher}>
        <button style={styles.monthButton} onClick={goToPreviousMonth}>
          ‹
        </button>
        <div style={styles.monthLabel}>{monthLabelFromKey(currentMonthKey)}</div>
        <button style={styles.monthButton} onClick={goToNextMonth}>
          ›
        </button>
      </div>

      <div style={styles.cardGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Planned Bills</div>
          <div style={styles.statValue}>{money(plannedBillsTotal)}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Paid</div>
          <div style={styles.statValue}>{money(paidBillsTotal)}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Remaining</div>
          <div style={styles.statValue}>{money(remainingBillsTotal)}</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Income</div>
          <div style={styles.statValue}>{money(incomeTotal)}</div>
        </div>

        <div style={{ ...styles.statCard, gridColumn: "1 / -1" }}>
          <div style={styles.statLabel}>Savings</div>
          <div style={styles.statValue}>{money(savingsTotal)}</div>
        </div>
      </div>

      <div style={styles.tabs}>
        <button
          style={activeTab === "bills" ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab("bills")}
        >
          Bills
        </button>

        <button
          style={activeTab === "budget" ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab("budget")}
        >
          Budget & Savings
        </button>

        <button
          style={activeTab === "calendar" ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab("calendar")}
        >
          Calendar
        </button>
      </div>

      {activeTab === "bills" && renderBillsTab()}
      {activeTab === "budget" && renderBudgetTab()}
      {activeTab === "calendar" && renderCalendarTab()}
    </div>
  );
}