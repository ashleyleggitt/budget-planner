"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "ashley-budget-planner-v2";

type Bill = {
  id: string;
  name: string;
  amount: number;
  defaultAmount: number;
  recurring: boolean;
  paid: boolean;
};

type Goal = {
  id: string;
  text: string;
};

type IncomeEntry = {
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

type CalendarMap = {
  [dateKey: string]: string[];
};

type MonthData = {
  checklist: Bill[];
  goals: Goal[];
  income: IncomeEntry[];
  savings: SavingsBucket[];
  notes: string;
  calendar: CalendarMap;
};

type MonthsMap = {
  [monthKey: string]: MonthData;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function monthLabelFromKey(key: string) {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getPreviousMonthKey(key: string) {
  const { year, month } = parseMonthKey(key);
  const prev = new Date(year, month - 2, 1);
  return monthKeyFromDate(prev);
}

function getNextMonthKey(key: string) {
  const { year, month } = parseMonthKey(key);
  const next = new Date(year, month, 1);
  return monthKeyFromDate(next);
}

function createEmptyMonth(): MonthData {
  return {
    checklist: [],
    goals: [],
    income: [],
    savings: [],
    notes: "",
    calendar: {},
  };
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function sumAmounts<T>(items: T[], getter: (item: T) => number) {
  return items.reduce((sum, item) => sum + Number(getter(item) || 0), 0);
}

function cloneRecurringBills(previousMonth?: MonthData): Bill[] {
  if (!previousMonth?.checklist?.length) return [];

  return previousMonth.checklist
    .filter((bill) => bill.recurring)
    .map((bill) => ({
      ...bill,
      id: createId(),
      paid: false,
      amount: bill.defaultAmount ?? bill.amount ?? 0,
    }));
}

function ensureMonthExists(months: MonthsMap, targetKey: string): MonthsMap {
  if (months[targetKey]) return months;

  const previousKey = getPreviousMonthKey(targetKey);
  const previousMonth = months[previousKey];

  return {
    ...months,
    [targetKey]: {
      ...createEmptyMonth(),
      checklist: previousMonth ? cloneRecurringBills(previousMonth) : [],
    },
  };
}

function getDaysInMonth(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1).getDay();
}

function buildCalendarCells(monthKey: string) {
  const totalDays = getDaysInMonth(monthKey);
  const firstDayIndex = getFirstDayOfWeek(monthKey);

  const cells: Array<{ type: "blank" } | { type: "day"; day: number; dateKey: string }> = [];

  for (let i = 0; i < firstDayIndex; i += 1) {
    cells.push({ type: "blank" });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    cells.push({ type: "day", day, dateKey });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ type: "blank" });
  }

  return cells;
}

export default function Page() {
  const todayKey = monthKeyFromDate(new Date());

  const [activeTab, setActiveTab] = useState<"bills" | "budget" | "calendar">("bills");
  const [currentMonthKey, setCurrentMonthKey] = useState(todayKey);

  const [months, setMonths] = useState<MonthsMap>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as MonthsMap;
          return ensureMonthExists(parsed, todayKey);
        } catch {
          return { [todayKey]: createEmptyMonth() };
        }
      }
    }
    return { [todayKey]: createEmptyMonth() };
  });

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDefaultAmount, setBillDefaultAmount] = useState("");
  const [billRecurring, setBillRecurring] = useState(false);

  const [goalText, setGoalText] = useState("");

  const [incomeLabel, setIncomeLabel] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const [savingsName, setSavingsName] = useState("");
  const [savingsCurrent, setSavingsCurrent] = useState("");
  const [savingsTarget, setSavingsTarget] = useState("");

  const [paidCollapsed, setPaidCollapsed] = useState(true);
  const [showCelebrate, setShowCelebrate] = useState(false);

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [calendarEntryText, setCalendarEntryText] = useState("");

  const previousUnpaidCountRef = useRef<number | null>(null);

  useEffect(() => {
    setMonths((prev) => ensureMonthExists(prev, currentMonthKey));
  }, [currentMonthKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(months));
    }
  }, [months]);

  const currentMonth = months[currentMonthKey] || createEmptyMonth();

  const unpaidBills = useMemo(
    () => currentMonth.checklist.filter((bill) => !bill.paid),
    [currentMonth.checklist]
  );

  const paidBills = useMemo(
    () => currentMonth.checklist.filter((bill) => bill.paid),
    [currentMonth.checklist]
  );

  const plannedBillsTotal = useMemo(
    () => sumAmounts(currentMonth.checklist, (bill) => bill.amount),
    [currentMonth.checklist]
  );

  const paidBillsTotal = useMemo(
    () => sumAmounts(paidBills, (bill) => bill.amount),
    [paidBills]
  );

  const remainingBillsTotal = plannedBillsTotal - paidBillsTotal;

  const incomeTotal = useMemo(
    () => sumAmounts(currentMonth.income, (entry) => entry.amount),
    [currentMonth.income]
  );

  const savingsTotal = useMemo(
    () => sumAmounts(currentMonth.savings, (bucket) => bucket.current),
    [currentMonth.savings]
  );

  const calendarCells = useMemo(() => buildCalendarCells(currentMonthKey), [currentMonthKey]);

  useEffect(() => {
    const currentUnpaidCount = unpaidBills.length;
    const previousUnpaidCount = previousUnpaidCountRef.current;

    if (
      previousUnpaidCount !== null &&
      previousUnpaidCount > 0 &&
      currentUnpaidCount === 0 &&
      currentMonth.checklist.length > 0
    ) {
      setShowCelebrate(true);
      const timer = setTimeout(() => setShowCelebrate(false), 2200);
      return () => clearTimeout(timer);
    }

    previousUnpaidCountRef.current = currentUnpaidCount;
  }, [unpaidBills.length, currentMonth.checklist.length, currentMonthKey]);

  useEffect(() => {
    previousUnpaidCountRef.current = unpaidBills.length;
  }, [currentMonthKey, unpaidBills.length]);

  function updateCurrentMonth(updater: (month: MonthData) => MonthData) {
    setMonths((prev) => {
      const safe = ensureMonthExists(prev, currentMonthKey);
      return {
        ...safe,
        [currentMonthKey]: updater(safe[currentMonthKey]),
      };
    });
  }

  function goToPreviousMonth() {
    const previousKey = getPreviousMonthKey(currentMonthKey);
    setMonths((prev) => ensureMonthExists(prev, previousKey));
    setCurrentMonthKey(previousKey);
    setSelectedDateKey(null);
    setCalendarEntryText("");
  }

  function goToNextMonth() {
    const nextKey = getNextMonthKey(currentMonthKey);
    setMonths((prev) => ensureMonthExists(prev, nextKey));
    setCurrentMonthKey(nextKey);
    setSelectedDateKey(null);
    setCalendarEntryText("");
  }

  function addBill() {
    const trimmedName = billName.trim();
    if (!trimmedName) return;

    const amountNumber = Number(billAmount) || 0;
    const defaultAmountNumber =
      billDefaultAmount === "" ? amountNumber : Number(billDefaultAmount) || 0;

    const newBill: Bill = {
      id: createId(),
      name: trimmedName,
      amount: amountNumber,
      defaultAmount: defaultAmountNumber,
      recurring: billRecurring,
      paid: false,
    };

    updateCurrentMonth((month) => ({
      ...month,
      checklist: [...month.checklist, newBill],
    }));

    setBillName("");
    setBillAmount("");
    setBillDefaultAmount("");
    setBillRecurring(false);
  }

  function toggleBillPaid(id: string) {
    updateCurrentMonth((month) => ({
      ...month,
      checklist: month.checklist.map((bill) =>
        bill.id === id ? { ...bill, paid: !bill.paid } : bill
      ),
    }));
  }

  function deleteBill(id: string) {
    updateCurrentMonth((month) => ({
      ...month,
      checklist: month.checklist.filter((bill) => bill.id !== id),
    }));
  }

  function addGoal() {
    const trimmed = goalText.trim();
    if (!trimmed) return;

    updateCurrentMonth((month) => ({
      ...month,
      goals: [...month.goals, { id: createId(), text: trimmed }],
    }));

    setGoalText("");
  }

  function deleteGoal(id: string) {
    updateCurrentMonth((month) => ({
      ...month,
      goals: month.goals.filter((goal) => goal.id !== id),
    }));
  }

  function addIncome() {
    if (!incomeAmount.trim()) return;

    updateCurrentMonth((month) => ({
      ...month,
      income: [
        ...month.income,
        {
          id: createId(),
          label: incomeLabel.trim() || "Income",
          amount: Number(incomeAmount) || 0,
        },
      ],
    }));

    setIncomeLabel("");
    setIncomeAmount("");
  }

  function deleteIncome(id: string) {
    updateCurrentMonth((month) => ({
      ...month,
      income: month.income.filter((entry) => entry.id !== id),
    }));
  }

  function addSavings() {
    const trimmedName = savingsName.trim();
    if (!trimmedName) return;

    updateCurrentMonth((month) => ({
      ...month,
      savings: [
        ...month.savings,
        {
          id: createId(),
          name: trimmedName,
          current: Number(savingsCurrent) || 0,
          target: Number(savingsTarget) || 0,
        },
      ],
    }));

    setSavingsName("");
    setSavingsCurrent("");
    setSavingsTarget("");
  }

  function deleteSavings(id: string) {
    updateCurrentMonth((month) => ({
      ...month,
      savings: month.savings.filter((bucket) => bucket.id !== id),
    }));
  }

  function updateNotes(value: string) {
    updateCurrentMonth((month) => ({
      ...month,
      notes: value,
    }));
  }

  function selectCalendarDay(dateKey: string) {
    setSelectedDateKey(dateKey);
    setCalendarEntryText("");
  }

  function addCalendarEntry() {
    if (!selectedDateKey) return;
    const trimmed = calendarEntryText.trim();
    if (!trimmed) return;

    updateCurrentMonth((month) => ({
      ...month,
      calendar: {
        ...month.calendar,
        [selectedDateKey]: [...(month.calendar[selectedDateKey] || []), trimmed],
      },
    }));

    setCalendarEntryText("");
  }

  function deleteCalendarEntry(dateKey: string, indexToDelete: number) {
    updateCurrentMonth((month) => {
      const existing = month.calendar[dateKey] || [];
      const updated = existing.filter((_, index) => index !== indexToDelete);

      const newCalendar = { ...month.calendar };

      if (updated.length === 0) {
        delete newCalendar[dateKey];
      } else {
        newCalendar[dateKey] = updated;
      }

      return {
        ...month,
        calendar: newCalendar,
      };
    });
  }

  const selectedEntries = selectedDateKey ? currentMonth.calendar[selectedDateKey] || [] : [];

  const styles: Record<string, React.CSSProperties> = {
    app: {
      minHeight: "100vh",
      background: "#fcfbf7",
      color: "#1f1f1f",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: "20px 14px 40px",
    },
    shell: {
      maxWidth: 1140,
      margin: "0 auto",
    },
    topTitle: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 14,
      color: "#2c2a25",
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: 18,
    },
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    statCard: {
      background: "#ffffff",
      border: "1px solid #e8e1c9",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
      minHeight: 86,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "#5b5548",
      marginBottom: 10,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 800,
    },
    monthSwitcher: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "#ffffff",
      border: "1px solid #e8e1c9",
      borderRadius: 18,
      padding: 10,
      boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
    },
    monthButton: {
      border: "1px solid #d8cb93",
      background: "#eae2b5",
      color: "#3e392c",
      borderRadius: 12,
      padding: "10px 12px",
      fontWeight: 700,
      cursor: "pointer",
    },
    monthLabel: {
      minWidth: 140,
      textAlign: "center",
      fontWeight: 700,
      fontSize: 18,
    },
    tabs: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 18,
    },
    tab: {
      border: "1px solid #3f3b35",
      background: "#ffffff",
      color: "#2a2824",
      borderRadius: 14,
      padding: "10px 14px",
      fontWeight: 700,
      cursor: "pointer",
    },
    activeTab: {
      border: "1px solid #d7c88f",
      background: "#efe4b9",
      color: "#3b3526",
      borderRadius: 14,
      padding: "10px 14px",
      fontWeight: 800,
      cursor: "pointer",
    },
    sectionGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 16,
    },
    panel: {
      background: "#ffffff",
      border: "1px solid #e8e1c9",
      borderRadius: 22,
      padding: 20,
      boxShadow: "0 4px 18px rgba(0,0,0,0.03)",
    },
    panelTitle: {
      fontSize: 18,
      fontWeight: 800,
      marginBottom: 6,
    },
    panelSub: {
      fontSize: 14,
      color: "#726c5f",
      marginBottom: 16,
    },
    monthSubtle: {
      fontSize: 14,
      color: "#726c5f",
      marginBottom: 18,
    },
    sectionLabel: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
      marginBottom: 10,
    },
    sectionLine: {
      height: 1,
      background: "#ece5cf",
      flex: 1,
    },
    sectionText: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.05em",
      color: "#5d574a",
      textTransform: "uppercase",
    },
    inputRow2: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      marginBottom: 12,
    },
    inputRow3: {
      display: "grid",
      gridTemplateColumns: "1fr 0.7fr auto",
      gap: 10,
      marginBottom: 12,
    },
    inputRow4: {
      display: "grid",
      gridTemplateColumns: "1.4fr 0.8fr auto auto",
      gap: 10,
      marginBottom: 12,
      alignItems: "center",
    },
    inputRowSavings: {
      display: "grid",
      gridTemplateColumns: "1.2fr 0.8fr 0.8fr auto",
      gap: 10,
      marginBottom: 12,
    },
    input: {
      width: "100%",
      border: "1px solid #e2dcc8",
      background: "#fcfbf7",
      borderRadius: 12,
      padding: "12px 12px",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      minHeight: 180,
      resize: "vertical",
      border: "1px solid #e2dcc8",
      background: "#fcfbf7",
      borderRadius: 14,
      padding: "14px 14px",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
    },
    addButton: {
      border: "1px solid #d7c88f",
      background: "#efe4b9",
      color: "#3e3726",
      borderRadius: 12,
      padding: "12px 16px",
      fontWeight: 700,
      cursor: "pointer",
      minWidth: 76,
    },
    checkboxWrap: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: "#5d574a",
      whiteSpace: "nowrap",
    },
    totalsBox: {
      border: "1px solid #eee6cc",
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      background: "#fffdf8",
    },
    totalsRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      padding: "7px 0",
      fontSize: 15,
    },
    listTitle: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color: "#5f594b",
      marginTop: 16,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      color: "#8a8374",
      fontSize: 14,
      padding: "6px 0 2px",
    },
    itemRow: {
      display: "grid",
      gridTemplateColumns: "28px 1fr auto auto",
      alignItems: "center",
      gap: 10,
      padding: "11px 2px",
      borderBottom: "1px solid #f0ebd8",
      transition: "all 0.25s ease",
    },
    paidItemRow: {
      display: "grid",
      gridTemplateColumns: "28px 1fr auto auto",
      alignItems: "center",
      gap: 10,
      padding: "11px 2px",
      borderBottom: "1px solid #f0ebd8",
      opacity: 0.6,
      transform: "translateY(2px)",
      transition: "all 0.25s ease",
    },
    itemName: {
      fontSize: 15,
      fontWeight: 500,
    },
    itemMeta: {
      fontSize: 12,
      color: "#7a7364",
      marginTop: 2,
    },
    amount: {
      fontWeight: 700,
      fontSize: 14,
    },
    deleteButton: {
      background: "transparent",
      border: "none",
      color: "#8b826e",
      fontSize: 18,
      cursor: "pointer",
      padding: 4,
      lineHeight: 1,
    },
    collapseBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#faf7ec",
      border: "1px solid #eee5c7",
      borderRadius: 14,
      padding: "12px 14px",
      marginTop: 12,
      cursor: "pointer",
      fontWeight: 700,
      color: "#4d4637",
    },
    simpleListRow: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #f0ebd8",
    },
    savingsRow: {
      display: "grid",
      gridTemplateColumns: "1fr auto auto auto",
      gap: 10,
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #f0ebd8",
    },
    calendarWrap: {
      display: "grid",
      gridTemplateColumns: "1.4fr 0.9fr",
      gap: 16,
      marginBottom: 16,
    },
    weekdayRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
      marginBottom: 8,
    },
    weekdayCell: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: 800,
      color: "#6e685d",
      textTransform: "uppercase",
      padding: "6px 0",
    },
    calendarGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 8,
    },
    blankDay: {
      minHeight: 92,
      borderRadius: 14,
      background: "#f8f6ef",
      border: "1px dashed #efe7cb",
    },
    dayCell: {
      minHeight: 92,
      borderRadius: 14,
      background: "#fffdf8",
      border: "1px solid #ece3c6",
      padding: 8,
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    selectedDayCell: {
      minHeight: 92,
      borderRadius: 14,
      background: "#f8f2d9",
      border: "1px solid #d8cb93",
      padding: 8,
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    dayNumber: {
      fontSize: 13,
      fontWeight: 800,
      color: "#3b372e",
    },
    miniEntry: {
      fontSize: 11,
      lineHeight: 1.25,
      color: "#5f594d",
      background: "#f5f0dd",
      borderRadius: 8,
      padding: "3px 5px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    moreText: {
      fontSize: 11,
      color: "#7b7567",
      fontWeight: 700,
    },
    sideCard: {
      background: "#fffdf8",
      border: "1px solid #ece3c6",
      borderRadius: 16,
      padding: 14,
      minHeight: 200,
    },
    sideTitle: {
      fontSize: 15,
      fontWeight: 800,
      marginBottom: 8,
    },
    sideSub: {
      fontSize: 13,
      color: "#70695c",
      marginBottom: 12,
    },
    entryList: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginTop: 10,
    },
    entryRow: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 8,
      alignItems: "center",
      border: "1px solid #eee5c7",
      background: "#fcfbf7",
      borderRadius: 10,
      padding: "8px 10px",
    },
    celebrationWrap: {
      position: "fixed",
      top: 18,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 100,
      pointerEvents: "none",
    },
    celebrationBox: {
      background: "#fffdf5",
      border: "1px solid #e9db9f",
      borderRadius: 18,
      padding: "12px 18px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
      fontWeight: 800,
      color: "#4a422d",
      textAlign: "center",
    },
    confettiRow: {
      display: "flex",
      justifyContent: "center",
      gap: 8,
      fontSize: 18,
      marginBottom: 6,
    },
  };

  function renderBillsTab() {
  return (
    <div style={styles.sectionGrid}>
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Month Overview</div>
        <div style={styles.monthSubtle}>{monthLabelFromKey(currentMonthKey)}</div>

        <div style={styles.sectionLabel}>
          <div style={styles.sectionLine} />
          <div style={styles.sectionText}>Goals</div>
          <div style={styles.sectionLine} />
        </div>

        <div style={styles.inputRow2}>
          <input
            style={styles.input}
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            placeholder="e.g. Save $1,000 · Spend less eating out"
          />
          <button style={styles.addButton} onClick={addGoal}>
            Add
          </button>
        </div>

        {currentMonth.goals.length === 0 ? (
          <div style={styles.emptyText}>No goals yet.</div>
        ) : (
          currentMonth.goals.map((goal) => (
            <div key={goal.id} style={styles.simpleListRow}>
              <div>{goal.text}</div>
              <button style={styles.deleteButton} onClick={() => deleteGoal(goal.id)}>
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Bills Checklist</div>
        <div style={styles.panelSub}>Bills do not require dates. Amounts optional.</div>

        <div style={styles.inputRow4}>
          <input
            style={styles.input}
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            placeholder="Rent, phone, internet..."
          />
          <input
            style={styles.input}
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            placeholder="$ (optional)"
            inputMode="decimal"
          />
          <label style={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={billRecurring}
              onChange={(e) => setBillRecurring(e.target.checked)}
            />
            recurring
          </label>
          <button style={styles.addButton} onClick={addBill}>
            Add
          </button>
        </div>

        <div style={styles.totalsBox}>
          <div style={styles.totalsRow}>
            <span>Planned</span>
            <strong>{money(plannedBillsTotal)}</strong>
          </div>
          <div style={styles.totalsRow}>
            <span>Paid</span>
            <strong>{money(paidBillsTotal)}</strong>
          </div>
          <div style={styles.totalsRow}>
            <span>Remaining</span>
            <strong>{money(remainingBillsTotal)}</strong>
          </div>
        </div>

        <div style={styles.listTitle}>Unpaid Bills</div>
        {unpaidBills.length === 0 ? (
          <div style={styles.emptyText}>No unpaid bills.</div>
        ) : (
          unpaidBills.map((bill) => (
            <div key={bill.id} style={styles.itemRow}>
              <input
                type="checkbox"
                checked={bill.paid}
                onChange={() => toggleBillPaid(bill.id)}
              />
              <div>
                <div style={styles.itemName}>{bill.name}</div>
                <div style={styles.itemMeta}>{bill.recurring ? "Recurring" : "One-time"}</div>
              </div>
              <div style={styles.amount}>{money(bill.amount)}</div>
              <button style={styles.deleteButton} onClick={() => deleteBill(bill.id)}>
                ×
              </button>
            </div>
          ))
        )}

        <div style={styles.collapseBar} onClick={() => setPaidCollapsed((prev) => !prev)}>
          <span>Paid Bills ({paidBills.length})</span>
          <span>{paidCollapsed ? "▾" : "▴"}</span>
        </div>

        {!paidCollapsed &&
          (paidBills.length === 0 ? (
            <div style={styles.emptyText}>No paid bills yet.</div>
          ) : (
            paidBills.map((bill) => (
              <div key={bill.id} style={styles.paidItemRow}>
                <input
                  type="checkbox"
                  checked={bill.paid}
                  onChange={() => toggleBillPaid(bill.id)}
                />
                <div>
                  <div style={styles.itemName}>{bill.name}</div>
                  <div style={styles.itemMeta}>{bill.recurring ? "Recurring" : "One-time"}</div>
                </div>
                <div style={styles.amount}>{money(bill.amount)}</div>
                <button style={styles.deleteButton} onClick={() => deleteBill(bill.id)}>
                  ×
                </button>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}

  function renderBudgetTab() {
    return (
      <div style={styles.sectionGrid}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Income</div>
          <div style={styles.panelSub}>Track monthly income entries.</div>

          <div style={styles.inputRow3}>
            <input
              style={styles.input}
              value={incomeLabel}
              onChange={(e) => setIncomeLabel(e.target.value)}
              placeholder="Paycheck, side income..."
            />
            <input
              style={styles.input}
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              placeholder="$ amount"
              inputMode="decimal"
            />
            <button style={styles.addButton} onClick={addIncome}>
              Add
            </button>
          </div>

          {currentMonth.income.length === 0 ? (
            <div style={styles.emptyText}>None yet.</div>
          ) : (
            currentMonth.income.map((entry) => (
              <div key={entry.id} style={styles.simpleListRow}>
                <div>{entry.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={styles.amount}>{money(entry.amount)}</div>
                  <button style={styles.deleteButton} onClick={() => deleteIncome(entry.id)}>
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Savings Buckets</div>
          <div style={styles.panelSub}>Track progress toward simple savings goals.</div>

          <div style={styles.inputRowSavings}>
            <input
              style={styles.input}
              value={savingsName}
              onChange={(e) => setSavingsName(e.target.value)}
              placeholder="Emergency fund..."
            />
            <input
              style={styles.input}
              value={savingsCurrent}
              onChange={(e) => setSavingsCurrent(e.target.value)}
              placeholder="$ current"
              inputMode="decimal"
            />
            <input
              style={styles.input}
              value={savingsTarget}
              onChange={(e) => setSavingsTarget(e.target.value)}
              placeholder="$ target"
              inputMode="decimal"
            />
            <button style={styles.addButton} onClick={addSavings}>
              Add
            </button>
          </div>

          {currentMonth.savings.length === 0 ? (
            <div style={styles.emptyText}>None yet.</div>
          ) : (
            currentMonth.savings.map((bucket) => (
              <div key={bucket.id} style={styles.savingsRow}>
                <div>{bucket.name}</div>
                <div style={styles.amount}>{money(bucket.current)}</div>
                <div style={{ color: "#7a7364", fontSize: 13 }}>
                  target {money(bucket.target)}
                </div>
                <button style={styles.deleteButton} onClick={() => deleteSavings(bucket.id)}>
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderCalendarTab() {
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Calendar</div>
        <div style={styles.panelSub}>
          Add work shifts, appointments, deadlines, or reminders for each day.
        </div>

        <div style={styles.calendarWrap}>
          <div>
            <div style={styles.weekdayRow}>
              {weekdays.map((day) => (
                <div key={day} style={styles.weekdayCell}>
                  {day}
                </div>
              ))}
            </div>

            <div style={styles.calendarGrid}>
              {calendarCells.map((cell, index) => {
                if (cell.type === "blank") {
                  return <div key={`blank-${index}`} style={styles.blankDay} />;
                }

                const entries = currentMonth.calendar[cell.dateKey] || [];
                const isSelected = selectedDateKey === cell.dateKey;

                return (
                  <div
                    key={cell.dateKey}
                    style={isSelected ? styles.selectedDayCell : styles.dayCell}
                    onClick={() => selectCalendarDay(cell.dateKey)}
                  >
                    <div style={styles.dayNumber}>{cell.day}</div>

                    {entries.slice(0, 3).map((entry, idx) => (
                      <div key={`${cell.dateKey}-${idx}`} style={styles.miniEntry}>
                        {entry}
                      </div>
                    ))}

                    {entries.length > 3 && (
                      <div style={styles.moreText}>+{entries.length - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.sideTitle}>
              {selectedDateKey ? `Selected Day: ${selectedDateKey}` : "Select a Day"}
            </div>
            <div style={styles.sideSub}>
              {selectedDateKey
                ? "Add short notes like work, appointment, payday, or project due."
                : "Click any day on the calendar to add entries."}
            </div>

            {selectedDateKey && (
              <>
                <div style={styles.inputRow2}>
                  <input
                    style={styles.input}
                    value={calendarEntryText}
                    onChange={(e) => setCalendarEntryText(e.target.value)}
                    placeholder="e.g. Work 7p-7a"
                  />
                  <button style={styles.addButton} onClick={addCalendarEntry}>
                    Add
                  </button>
                </div>

                {selectedEntries.length === 0 ? (
                  <div style={styles.emptyText}>No entries for this day yet.</div>
                ) : (
                  <div style={styles.entryList}>
                    {selectedEntries.map((entry, index) => (
                      <div key={`${selectedDateKey}-${index}`} style={styles.entryRow}>
                        <div>{entry}</div>
                        <button
                          style={styles.deleteButton}
                          onClick={() => deleteCalendarEntry(selectedDateKey, index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <textarea
          style={styles.textarea}
          value={currentMonth.notes}
          onChange={(e) => updateNotes(e.target.value)}
          placeholder="Month notes, payday reminders, work schedule, project notes, or anything you want to remember..."
        />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {showCelebrate && (
        <div style={styles.celebrationWrap}>
          <div style={styles.celebrationBox}>
            <div style={styles.confettiRow}>
              <span>✨</span>
              <span>🎉</span>
              <span>✨</span>
            </div>
            All bills paid for {monthLabelFromKey(currentMonthKey)}!
          </div>
        </div>
      )}

     <div style={styles.shell}>
  <div style={styles.topTitle}>Bill Reminder + Budget Tracker</div>

  <div style={styles.monthSwitcher}>
  ...
</div>

<div style={styles.headerRow}>
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
            <div style={styles.statCard}>
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