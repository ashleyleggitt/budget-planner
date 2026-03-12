"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TabKey = "bills" | "budget" | "calendar";

type Bill = {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  recurring: boolean;
  recurringKey?: string;
};

type MonthBudget = {
  bills: Bill[];
  notes: string;
};

type SavingsBucket = {
  id: string;
  name: string;
  amount: number;
  target: number;
};

type IncomeEntry = {
  id: string;
  label: string;
  amount: number;
};

type Goal = {
  id: string;
  name: string;
};

type CalendarEntry = {
  id: string;
  text: string;
};

type CalendarMonth = {
  [day: string]: CalendarEntry[];
};

type AppData = {
  monthData: Record<string, MonthBudget>;
  savingsBuckets: SavingsBucket[];
  incomesByMonth: Record<string, IncomeEntry[]>;
  goals: Goal[];
  calendarByMonth: Record<string, CalendarMonth>;
};

type ExportPayload = {
  exportedAt?: string;
  currentMonth?: string;
  appData?: AppData;
};

const STORAGE_KEY = "budget-life-tracker-v3";
const LEGACY_STORAGE_KEYS = [
  "budget-life-tracker-v2",
  "budget-life-tracker-v1",
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return getCurrentMonthKey(d);
}

function getNextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month, 1);
  return getCurrentMonthKey(d);
}

function monthKeyToNumber(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return year * 12 + month;
}

function compareMonthKeys(a: string, b: string) {
  return monthKeyToNumber(a) - monthKeyToNumber(b);
}

function getDaysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).getDay();
}

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function safeNumber(input: string) {
  const num = parseFloat(input);
  return Number.isFinite(num) ? num : 0;
}

function isValidMonthKey(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function defaultData(): AppData {
  const currentMonth = getCurrentMonthKey();
  return {
    monthData: {
      [currentMonth]: {
        bills: [],
        notes: "",
      },
    },
    savingsBuckets: [],
    incomesByMonth: {
      [currentMonth]: [],
    },
    goals: [],
    calendarByMonth: {
      [currentMonth]: {},
    },
  };
}

function getBillRecurringKey(bill: Bill) {
  return bill.recurringKey || `legacy-${bill.name}-${bill.amount}`;
}

function cloneRecurringBillForNewMonth(bill: Bill): Bill {
  return {
    id: createId(),
    name: bill.name,
    amount: bill.amount,
    paid: false,
    recurring: true,
    recurringKey: getBillRecurringKey(bill),
  };
}

function normalizeData(data: AppData): AppData {
  const normalizedMonthData: Record<string, MonthBudget> = {};

  Object.entries(data.monthData || {}).forEach(([monthKey, monthBudget]) => {
    normalizedMonthData[monthKey] = {
      notes: monthBudget?.notes || "",
      bills: (monthBudget?.bills || []).map((bill) => ({
        ...bill,
        recurringKey: bill.recurring
          ? bill.recurringKey || `legacy-${bill.name}-${bill.amount}`
          : bill.recurringKey,
      })),
    };
  });

  return {
    monthData: normalizedMonthData,
    savingsBuckets: (data.savingsBuckets || []).map((bucket) => ({
      ...bucket,
      target: typeof bucket.target === "number" ? bucket.target : 0,
    })),
    incomesByMonth: data.incomesByMonth || {},
    goals: (data.goals || []).map((goal) => ({
      id: goal.id,
      name: goal.name,
    })),
    calendarByMonth: data.calendarByMonth || {},
  };
}

function ensureMonthData(data: AppData, monthKey: string): AppData {
  const normalized = normalizeData(data);

  const nextData: AppData = {
    monthData: { ...normalized.monthData },
    savingsBuckets: [...normalized.savingsBuckets],
    incomesByMonth: { ...normalized.incomesByMonth },
    goals: [...normalized.goals],
    calendarByMonth: { ...normalized.calendarByMonth },
  };

  if (!nextData.monthData[monthKey]) {
    nextData.monthData[monthKey] = {
      bills: [],
      notes: "",
    };
  }

  if (!nextData.incomesByMonth[monthKey]) {
    nextData.incomesByMonth[monthKey] = [];
  }

  if (!nextData.calendarByMonth[monthKey]) {
    nextData.calendarByMonth[monthKey] = {};
  }

  const earlierMonths = Object.keys(nextData.monthData)
    .filter((key) => compareMonthKeys(key, monthKey) < 0)
    .sort(compareMonthKeys);

  const recurringMap = new Map<string, Bill>();

  for (const earlierMonth of earlierMonths) {
    const bills = nextData.monthData[earlierMonth]?.bills || [];
    for (const bill of bills) {
      if (bill.recurring) {
        recurringMap.set(getBillRecurringKey(bill), bill);
      }
    }
  }

  const currentBills = nextData.monthData[monthKey].bills || [];
  const existingRecurringKeys = new Set(
    currentBills
      .filter((bill) => bill.recurring)
      .map((bill) => getBillRecurringKey(bill))
  );

  const inheritedBills = Array.from(recurringMap.values())
    .filter((bill) => !existingRecurringKeys.has(getBillRecurringKey(bill)))
    .map(cloneRecurringBillForNewMonth);

  if (inheritedBills.length > 0) {
    nextData.monthData[monthKey] = {
      ...nextData.monthData[monthKey],
      bills: [...currentBills, ...inheritedBills],
    };
  }

  return nextData;
}

export default function Page() {
  const [mounted, setMounted] = useState(false);

  const [appData, setAppData] = useState<AppData>(defaultData());
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey());
  const [activeTab, setActiveTab] = useState<TabKey>("bills");
  const [showPaidBills, setShowPaidBills] = useState(false);

  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillRecurring, setNewBillRecurring] = useState(false);

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingBillName, setEditingBillName] = useState("");
  const [editingBillAmount, setEditingBillAmount] = useState("");
  const [editingBillRecurring, setEditingBillRecurring] = useState(false);

  const [newIncomeLabel, setNewIncomeLabel] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState("");
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingIncomeLabel, setEditingIncomeLabel] = useState("");
  const [editingIncomeAmount, setEditingIncomeAmount] = useState("");

  const [newSavingsName, setNewSavingsName] = useState("");
  const [newSavingsAmount, setNewSavingsAmount] = useState("");
  const [newSavingsTarget, setNewSavingsTarget] = useState("");
  const [editingSavingsId, setEditingSavingsId] = useState<string | null>(null);
  const [editingSavingsName, setEditingSavingsName] = useState("");
  const [editingSavingsAmount, setEditingSavingsAmount] = useState("");
  const [editingSavingsTarget, setEditingSavingsTarget] = useState("");

  const [newGoalName, setNewGoalName] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalName, setEditingGoalName] = useState("");

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [newCalendarEntry, setNewCalendarEntry] = useState("");
  const [editingCalendarEntryId, setEditingCalendarEntryId] = useState<string | null>(null);
  const [editingCalendarEntryText, setEditingCalendarEntryText] = useState("");

  const [celebrateBillsPaid, setCelebrateBillsPaid] = useState(false);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);

    try {
      let stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacyStored = localStorage.getItem(legacyKey);
          if (legacyStored) {
            stored = legacyStored;
            break;
          }
        }
      }

      if (stored) {
        const parsed = JSON.parse(stored) as AppData;
        const hydrated = ensureMonthData(parsed, getCurrentMonthKey());
        setAppData(hydrated);
      } else {
        setAppData(ensureMonthData(defaultData(), getCurrentMonthKey()));
      }
    } catch {
      setAppData(ensureMonthData(defaultData(), getCurrentMonthKey()));
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData, mounted]);

  useEffect(() => {
    if (!mounted) return;
    setAppData((prev) => ensureMonthData(prev, currentMonth));
    const days = getDaysInMonth(currentMonth);
    if (selectedDay > days) {
      setSelectedDay(days);
    }
  }, [currentMonth, mounted, selectedDay]);

  const monthBudget = useMemo(() => {
    return appData.monthData[currentMonth] || { bills: [], notes: "" };
  }, [appData.monthData, currentMonth]);

  const incomes = useMemo(() => {
    return appData.incomesByMonth[currentMonth] || [];
  }, [appData.incomesByMonth, currentMonth]);

  const calendarMonth = useMemo(() => {
    return appData.calendarByMonth[currentMonth] || {};
  }, [appData.calendarByMonth, currentMonth]);

  const selectedDayEntries = useMemo(() => {
    return calendarMonth[String(selectedDay)] || [];
  }, [calendarMonth, selectedDay]);

  const unpaidBills = monthBudget.bills.filter((b) => !b.paid);
  const paidBills = monthBudget.bills.filter((b) => b.paid);

  const totalBills = monthBudget.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPaid = paidBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalRemaining = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalSavings = appData.savingsBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);

  useEffect(() => {
    if (!mounted) return;

    const hasBills = monthBudget.bills.length > 0;
    const allPaid = hasBills && unpaidBills.length === 0;

    if (allPaid) {
      setCelebrateBillsPaid(true);
      const timer = setTimeout(() => setCelebrateBillsPaid(false), 2400);
      return () => clearTimeout(timer);
    } else {
      setCelebrateBillsPaid(false);
    }
  }, [monthBudget.bills.length, unpaidBills.length, mounted]);

  function updateAppData(updater: (prev: AppData) => AppData) {
    setAppData((prev) => updater(ensureMonthData(prev, currentMonth)));
  }

  function exportData() {
    const exportPayload: ExportPayload = {
      exportedAt: new Date().toISOString(),
      currentMonth,
      appData,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-life-tracker-${currentMonth}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function triggerImport() {
    importInputRef.current?.click();
  }

  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const rawText = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(rawText) as ExportPayload | AppData;

        const importedAppData =
          parsed && typeof parsed === "object" && "appData" in parsed && parsed.appData
            ? parsed.appData
            : (parsed as AppData);

        if (
          !importedAppData ||
          typeof importedAppData !== "object" ||
          !("monthData" in importedAppData) ||
          !("savingsBuckets" in importedAppData) ||
          !("incomesByMonth" in importedAppData) ||
          !("goals" in importedAppData) ||
          !("calendarByMonth" in importedAppData)
        ) {
          throw new Error("Invalid import file");
        }

        const importedMonth =
          parsed &&
          typeof parsed === "object" &&
          "currentMonth" in parsed &&
          isValidMonthKey(parsed.currentMonth)
            ? parsed.currentMonth
            : getCurrentMonthKey();

        const hydrated = ensureMonthData(importedAppData, importedMonth!);

        setAppData(hydrated);
        setCurrentMonth(importedMonth!);
        setSelectedDay(1);
        setShowPaidBills(false);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
      } catch {
        window.alert("Could not import file. Please choose a valid exported JSON file.");
      } finally {
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      window.alert("Could not read file. Please try again.");
      event.target.value = "";
    };

    reader.readAsText(file);
  }

  function handleAddBill() {
    if (!newBillName.trim()) return;

    const recurringKey = newBillRecurring ? createId() : undefined;

    const bill: Bill = {
      id: createId(),
      name: newBillName.trim(),
      amount: safeNumber(newBillAmount),
      paid: false,
      recurring: newBillRecurring,
      recurringKey,
    };

    updateAppData((prev) => ({
      ...prev,
      monthData: {
        ...prev.monthData,
        [currentMonth]: {
          ...prev.monthData[currentMonth],
          bills: [...prev.monthData[currentMonth].bills, bill],
        },
      },
    }));

    setNewBillName("");
    setNewBillAmount("");
    setNewBillRecurring(false);
  }

  function toggleBillPaid(id: string) {
    updateAppData((prev) => ({
      ...prev,
      monthData: {
        ...prev.monthData,
        [currentMonth]: {
          ...prev.monthData[currentMonth],
          bills: prev.monthData[currentMonth].bills.map((bill) =>
            bill.id === id ? { ...bill, paid: !bill.paid } : bill
          ),
        },
      },
    }));
  }

  function deleteBill(id: string) {
    updateAppData((prev) => ({
      ...prev,
      monthData: {
        ...prev.monthData,
        [currentMonth]: {
          ...prev.monthData[currentMonth],
          bills: prev.monthData[currentMonth].bills.filter((bill) => bill.id !== id),
        },
      },
    }));
  }

  function startEditBill(bill: Bill) {
    setEditingBillId(bill.id);
    setEditingBillName(bill.name);
    setEditingBillAmount(String(bill.amount));
    setEditingBillRecurring(bill.recurring);
  }

  function saveEditBill() {
    if (!editingBillId || !editingBillName.trim()) return;

    updateAppData((prev) => ({
      ...prev,
      monthData: {
        ...prev.monthData,
        [currentMonth]: {
          ...prev.monthData[currentMonth],
          bills: prev.monthData[currentMonth].bills.map((bill) => {
            if (bill.id !== editingBillId) return bill;

            const willBeRecurring = editingBillRecurring;
            const recurringKey = willBeRecurring
              ? bill.recurringKey || createId()
              : undefined;

            return {
              ...bill,
              name: editingBillName.trim(),
              amount: safeNumber(editingBillAmount),
              recurring: willBeRecurring,
              recurringKey,
            };
          }),
        },
      },
    }));

    setEditingBillId(null);
    setEditingBillName("");
    setEditingBillAmount("");
    setEditingBillRecurring(false);
  }

  function handleAddIncome() {
    if (!newIncomeLabel.trim()) return;

    const item: IncomeEntry = {
      id: createId(),
      label: newIncomeLabel.trim(),
      amount: safeNumber(newIncomeAmount),
    };

    updateAppData((prev) => ({
      ...prev,
      incomesByMonth: {
        ...prev.incomesByMonth,
        [currentMonth]: [...(prev.incomesByMonth[currentMonth] || []), item],
      },
    }));

    setNewIncomeLabel("");
    setNewIncomeAmount("");
  }

  function deleteIncome(id: string) {
    updateAppData((prev) => ({
      ...prev,
      incomesByMonth: {
        ...prev.incomesByMonth,
        [currentMonth]: (prev.incomesByMonth[currentMonth] || []).filter((item) => item.id !== id),
      },
    }));
  }

  function startEditIncome(item: IncomeEntry) {
    setEditingIncomeId(item.id);
    setEditingIncomeLabel(item.label);
    setEditingIncomeAmount(String(item.amount));
  }

  function saveEditIncome() {
    if (!editingIncomeId || !editingIncomeLabel.trim()) return;

    updateAppData((prev) => ({
      ...prev,
      incomesByMonth: {
        ...prev.incomesByMonth,
        [currentMonth]: (prev.incomesByMonth[currentMonth] || []).map((item) =>
          item.id === editingIncomeId
            ? {
                ...item,
                label: editingIncomeLabel.trim(),
                amount: safeNumber(editingIncomeAmount),
              }
            : item
        ),
      },
    }));

    setEditingIncomeId(null);
    setEditingIncomeLabel("");
    setEditingIncomeAmount("");
  }

  function handleAddSavingsBucket() {
    if (!newSavingsName.trim()) return;

    const bucket: SavingsBucket = {
      id: createId(),
      name: newSavingsName.trim(),
      amount: safeNumber(newSavingsAmount),
      target: safeNumber(newSavingsTarget),
    };

    updateAppData((prev) => ({
      ...prev,
      savingsBuckets: [...prev.savingsBuckets, bucket],
    }));

    setNewSavingsName("");
    setNewSavingsAmount("");
    setNewSavingsTarget("");
  }

  function deleteSavingsBucket(id: string) {
    updateAppData((prev) => ({
      ...prev,
      savingsBuckets: prev.savingsBuckets.filter((bucket) => bucket.id !== id),
    }));
  }

  function startEditSavings(bucket: SavingsBucket) {
    setEditingSavingsId(bucket.id);
    setEditingSavingsName(bucket.name);
    setEditingSavingsAmount(String(bucket.amount));
    setEditingSavingsTarget(String(bucket.target));
  }

  function saveEditSavings() {
    if (!editingSavingsId || !editingSavingsName.trim()) return;

    updateAppData((prev) => ({
      ...prev,
      savingsBuckets: prev.savingsBuckets.map((bucket) =>
        bucket.id === editingSavingsId
          ? {
              ...bucket,
              name: editingSavingsName.trim(),
              amount: safeNumber(editingSavingsAmount),
              target: safeNumber(editingSavingsTarget),
            }
          : bucket
      ),
    }));

    setEditingSavingsId(null);
    setEditingSavingsName("");
    setEditingSavingsAmount("");
    setEditingSavingsTarget("");
  }

  function handleAddGoal() {
    if (!newGoalName.trim()) return;

    const goal: Goal = {
      id: createId(),
      name: newGoalName.trim(),
    };

    updateAppData((prev) => ({
      ...prev,
      goals: [...prev.goals, goal],
    }));

    setNewGoalName("");
  }

  function deleteGoal(id: string) {
    updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.filter((goal) => goal.id !== id),
    }));
  }

  function startEditGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setEditingGoalName(goal.name);
  }

  function saveEditGoal() {
    if (!editingGoalId || !editingGoalName.trim()) return;

    updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) =>
        goal.id === editingGoalId
          ? {
              ...goal,
              name: editingGoalName.trim(),
            }
          : goal
      ),
    }));

    setEditingGoalId(null);
    setEditingGoalName("");
  }

  function saveMonthNotes(notes: string) {
    updateAppData((prev) => ({
      ...prev,
      monthData: {
        ...prev.monthData,
        [currentMonth]: {
          ...prev.monthData[currentMonth],
          notes,
        },
      },
    }));
  }

  function addCalendarEntry() {
    if (!newCalendarEntry.trim()) return;

    const dayKey = String(selectedDay);
    const entry: CalendarEntry = {
      id: createId(),
      text: newCalendarEntry.trim(),
    };

    updateAppData((prev) => ({
      ...prev,
      calendarByMonth: {
        ...prev.calendarByMonth,
        [currentMonth]: {
          ...(prev.calendarByMonth[currentMonth] || {}),
          [dayKey]: [...((prev.calendarByMonth[currentMonth] || {})[dayKey] || []), entry],
        },
      },
    }));

    setNewCalendarEntry("");
  }

  function deleteCalendarEntry(entryId: string) {
    const dayKey = String(selectedDay);

    updateAppData((prev) => ({
      ...prev,
      calendarByMonth: {
        ...prev.calendarByMonth,
        [currentMonth]: {
          ...(prev.calendarByMonth[currentMonth] || {}),
          [dayKey]: (((prev.calendarByMonth[currentMonth] || {})[dayKey] || []).filter(
            (entry) => entry.id !== entryId
          )),
        },
      },
    }));
  }

  function startEditCalendarEntry(entry: CalendarEntry) {
    setEditingCalendarEntryId(entry.id);
    setEditingCalendarEntryText(entry.text);
  }

  function saveEditCalendarEntry() {
    if (!editingCalendarEntryId || !editingCalendarEntryText.trim()) return;

    const dayKey = String(selectedDay);

    updateAppData((prev) => ({
      ...prev,
      calendarByMonth: {
        ...prev.calendarByMonth,
        [currentMonth]: {
          ...(prev.calendarByMonth[currentMonth] || {}),
          [dayKey]: (((prev.calendarByMonth[currentMonth] || {})[dayKey] || []).map((entry) =>
            entry.id === editingCalendarEntryId
              ? { ...entry, text: editingCalendarEntryText.trim() }
              : entry
          )),
        },
      },
    }));

    setEditingCalendarEntryId(null);
    setEditingCalendarEntryText("");
  }

  function renderMiniActionButtons(onEdit: () => void, onDelete: () => void) {
    return (
      <div style={styles.inlineActions}>
        <button style={styles.plusButton} onClick={onEdit} type="button">
          +
        </button>
        <button style={styles.minusButton} onClick={onDelete} type="button">
          −
        </button>
      </div>
    );
  }

  function renderCelebration() {
    if (!celebrateBillsPaid) return null;

    return (
      <div style={styles.celebrationCard}>
        <div style={styles.celebrationEmojiRow}>
          <span style={styles.celebrationEmoji}>✨</span>
          <span style={styles.celebrationEmoji}>💸</span>
          <span style={styles.celebrationEmoji}>✨</span>
        </div>
        <div style={styles.celebrationTitle}>All bills are paid!</div>
        <div style={styles.celebrationSubtext}>Nice work. This month is handled.</div>
      </div>
    );
  }

  function renderCalendarGrid() {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} style={styles.calendarEmptyCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayEntries = calendarMonth[String(day)] || [];
      const isSelected = selectedDay === day;

      cells.push(
        <button
          key={day}
          type="button"
          onClick={() => setSelectedDay(day)}
          style={{
            ...styles.calendarDayCell,
            ...(isSelected ? styles.calendarDayCellSelected : {}),
          }}
        >
          <div style={styles.calendarDayNumber}>{day}</div>

          <div style={styles.calendarPreviewWrap}>
            {dayEntries.slice(0, 2).map((entry) => (
              <div key={entry.id} style={styles.calendarPreviewText}>
                {entry.text}
              </div>
            ))}
            {dayEntries.length > 2 && (
              <div style={styles.calendarMoreText}>+{dayEntries.length - 2} more</div>
            )}
          </div>
        </button>
      );
    }

    return <div style={styles.calendarGrid}>{cells}</div>;
  }

  if (!mounted) {
    return <div style={styles.page} />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.appShell}>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          style={styles.hiddenFileInput}
        />

                <div style={styles.topBar}>
          <div style={styles.topBarSide} />
          <div style={styles.topBarCenter}>
            <div style={styles.brandWrap}>
              <h1 style={styles.brandTitle}>
                Budget<span style={styles.gold}>365</span>
              </h1>
              <div style={styles.subtitle}>Budget & Life Tracker</div>
            </div>
          </div>
          <div style={styles.topBarSideRight}>
            <div style={styles.topBarButtons}>
              <button style={styles.exportButton} onClick={exportData} type="button">
                Export
              </button>
              <button style={styles.exportButton} onClick={triggerImport} type="button">
                Import
              </button>
            </div>
          </div>
        </div>

        <div style={styles.monthHeroCard}>
          <button
            type="button"
            onClick={() => setCurrentMonth(getPreviousMonthKey(currentMonth))}
            style={styles.monthArrow}
          >
            ←
          </button>

          <div style={styles.monthCenterWrap}>
            <div style={styles.monthBigLabel}>{formatMonthLabel(currentMonth)}</div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentMonth(getNextMonthKey(currentMonth))}
            style={styles.monthArrow}
          >
            →
          </button>
        </div>

        {renderCelebration()}

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Bills Remaining</div>
            <div style={styles.summaryValue}>{currency(totalRemaining)}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Paid This Month</div>
            <div style={styles.summaryValue}>{currency(totalPaid)}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Savings Total</div>
            <div style={styles.summaryValue}>{currency(totalSavings)}</div>
          </div>
        </div>

        <div style={styles.tabBar}>
          <button
            type="button"
            onClick={() => setActiveTab("bills")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "bills" ? styles.tabButtonActive : {}),
            }}
          >
            Bills
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("budget")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "budget" ? styles.tabButtonActive : {}),
            }}
          >
            Budget &amp; Savings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "calendar" ? styles.tabButtonActive : {}),
            }}
          >
            Calendar
          </button>
        </div>

        {activeTab === "bills" && (
          <div style={styles.sectionStack}>
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Add Bill</h2>
                <div style={styles.sectionMiniTotal}>Total: {currency(totalBills)}</div>
              </div>

              <div style={styles.formStack}>
                <input
                  style={styles.input}
                  placeholder="Bill name"
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Amount"
                  inputMode="decimal"
                  value={newBillAmount}
                  onChange={(e) => setNewBillAmount(e.target.value)}
                />
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={newBillRecurring}
                    onChange={(e) => setNewBillRecurring(e.target.checked)}
                  />
                  <span>Recurring bill</span>
                </label>
                <button type="button" onClick={handleAddBill} style={styles.primaryButton}>
                  Add Bill
                </button>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Unpaid Bills</h2>
              </div>

              {unpaidBills.length === 0 ? (
                <div style={styles.emptyText}>No unpaid bills for this month.</div>
              ) : (
                unpaidBills.map((bill) => (
                  <div key={bill.id} style={styles.listRow}>
                    {editingBillId === bill.id ? (
                      <div style={styles.editStack}>
                        <input
                          style={styles.input}
                          value={editingBillName}
                          onChange={(e) => setEditingBillName(e.target.value)}
                        />
                        <input
                          style={styles.input}
                          inputMode="decimal"
                          value={editingBillAmount}
                          onChange={(e) => setEditingBillAmount(e.target.value)}
                        />
                        <label style={styles.checkboxRow}>
                          <input
                            type="checkbox"
                            checked={editingBillRecurring}
                            onChange={(e) => setEditingBillRecurring(e.target.checked)}
                          />
                          <span>Recurring bill</span>
                        </label>
                        <button type="button" style={styles.primaryButton} onClick={saveEditBill}>
                          Save Bill
                        </button>
                      </div>
                    ) : (
                      <>
                        <label style={styles.billCheckWrap}>
                          <input
                            type="checkbox"
                            checked={bill.paid}
                            onChange={() => toggleBillPaid(bill.id)}
                          />
                        </label>

                        <div style={styles.flexGrow}>
                          <div style={styles.rowTitle}>{bill.name}</div>
                          <div style={styles.rowSubtle}>
                            {currency(bill.amount)}
                            {bill.recurring ? " • Recurring" : ""}
                          </div>
                        </div>

                        {renderMiniActionButtons(
                          () => startEditBill(bill),
                          () => deleteBill(bill.id)
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </section>

            <section style={styles.card}>
              <button
                type="button"
                onClick={() => setShowPaidBills((prev) => !prev)}
                style={styles.collapseButton}
              >
                {showPaidBills ? "Hide Paid Bills" : `Show Paid Bills (${paidBills.length})`}
              </button>

              {showPaidBills && (
                <div style={{ marginTop: 12 }}>
                  {paidBills.length === 0 ? (
                    <div style={styles.emptyText}>No paid bills yet.</div>
                  ) : (
                    paidBills.map((bill) => (
                      <div key={bill.id} style={styles.listRow}>
                        {editingBillId === bill.id ? (
                          <div style={styles.editStack}>
                            <input
                              style={styles.input}
                              value={editingBillName}
                              onChange={(e) => setEditingBillName(e.target.value)}
                            />
                            <input
                              style={styles.input}
                              inputMode="decimal"
                              value={editingBillAmount}
                              onChange={(e) => setEditingBillAmount(e.target.value)}
                            />
                            <label style={styles.checkboxRow}>
                              <input
                                type="checkbox"
                                checked={editingBillRecurring}
                                onChange={(e) => setEditingBillRecurring(e.target.checked)}
                              />
                              <span>Recurring bill</span>
                            </label>
                            <button
                              type="button"
                              style={styles.primaryButton}
                              onClick={saveEditBill}
                            >
                              Save Bill
                            </button>
                          </div>
                        ) : (
                          <>
                            <label style={styles.billCheckWrap}>
                              <input
                                type="checkbox"
                                checked={bill.paid}
                                onChange={() => toggleBillPaid(bill.id)}
                              />
                            </label>

                            <div style={styles.flexGrow}>
                              <div style={{ ...styles.rowTitle, textDecoration: "line-through" }}>
                                {bill.name}
                              </div>
                              <div style={styles.rowSubtle}>
                                {currency(bill.amount)}
                                {bill.recurring ? " • Recurring" : ""}
                              </div>
                            </div>

                            {renderMiniActionButtons(
                              () => startEditBill(bill),
                              () => deleteBill(bill.id)
                            )}
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Month Notes</h2>
              </div>
              <textarea
                style={styles.textarea}
                placeholder="Write notes for this month..."
                value={monthBudget.notes}
                onChange={(e) => saveMonthNotes(e.target.value)}
              />
            </section>
          </div>
        )}

        {activeTab === "budget" && (
          <div style={styles.sectionStack}>
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Income</h2>
                <div style={styles.sectionMiniTotal}>{currency(totalIncome)}</div>
              </div>

              <div style={styles.formStack}>
                <input
                  style={styles.input}
                  placeholder="Income label"
                  value={newIncomeLabel}
                  onChange={(e) => setNewIncomeLabel(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Amount"
                  inputMode="decimal"
                  value={newIncomeAmount}
                  onChange={(e) => setNewIncomeAmount(e.target.value)}
                />
                <button type="button" onClick={handleAddIncome} style={styles.primaryButton}>
                  Add Income
                </button>
              </div>

              <div style={styles.listWrap}>
                {incomes.length === 0 ? (
                  <div style={styles.emptyText}>No income added for this month.</div>
                ) : (
                  incomes.map((item) => (
                    <div key={item.id} style={styles.listRow}>
                      {editingIncomeId === item.id ? (
                        <div style={styles.editStack}>
                          <input
                            style={styles.input}
                            value={editingIncomeLabel}
                            onChange={(e) => setEditingIncomeLabel(e.target.value)}
                          />
                          <input
                            style={styles.input}
                            inputMode="decimal"
                            value={editingIncomeAmount}
                            onChange={(e) => setEditingIncomeAmount(e.target.value)}
                          />
                          <button
                            type="button"
                            style={styles.primaryButton}
                            onClick={saveEditIncome}
                          >
                            Save Income
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={styles.flexGrow}>
                            <div style={styles.rowTitle}>{item.label}</div>
                            <div style={styles.rowSubtle}>{currency(item.amount)}</div>
                          </div>
                          {renderMiniActionButtons(
                            () => startEditIncome(item),
                            () => deleteIncome(item.id)
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Savings Buckets</h2>
                <div style={styles.sectionMiniTotal}>{currency(totalSavings)}</div>
              </div>

              <div style={styles.formStack}>
                <input
                  style={styles.input}
                  placeholder="Savings bucket"
                  value={newSavingsName}
                  onChange={(e) => setNewSavingsName(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Amount"
                  inputMode="decimal"
                  value={newSavingsAmount}
                  onChange={(e) => setNewSavingsAmount(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Target amount"
                  inputMode="decimal"
                  value={newSavingsTarget}
                  onChange={(e) => setNewSavingsTarget(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddSavingsBucket}
                  style={styles.primaryButton}
                >
                  Add Savings Bucket
                </button>
              </div>

              <div style={styles.listWrap}>
                {appData.savingsBuckets.length === 0 ? (
                  <div style={styles.emptyText}>No savings buckets yet.</div>
                ) : (
                  appData.savingsBuckets.map((bucket) => (
                    <div key={bucket.id} style={styles.listRow}>
                      {editingSavingsId === bucket.id ? (
                        <div style={styles.editStack}>
                          <input
                            style={styles.input}
                            value={editingSavingsName}
                            onChange={(e) => setEditingSavingsName(e.target.value)}
                          />
                          <input
                            style={styles.input}
                            inputMode="decimal"
                            value={editingSavingsAmount}
                            onChange={(e) => setEditingSavingsAmount(e.target.value)}
                          />
                          <input
                            style={styles.input}
                            inputMode="decimal"
                            value={editingSavingsTarget}
                            onChange={(e) => setEditingSavingsTarget(e.target.value)}
                          />
                          <button
                            type="button"
                            style={styles.primaryButton}
                            onClick={saveEditSavings}
                          >
                            Save Bucket
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={styles.flexGrow}>
                            <div style={styles.rowTitle}>{bucket.name}</div>
                            <div style={styles.rowSubtle}>{currency(bucket.amount)}</div>
                            <div style={styles.rowSubtle}>Target: {currency(bucket.target)}</div>
                          </div>
                          {renderMiniActionButtons(
                            () => startEditSavings(bucket),
                            () => deleteSavingsBucket(bucket.id)
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Goals</h2>
              </div>

              <div style={styles.formStack}>
                <input
                  style={styles.input}
                  placeholder="Goal name"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                />
                <button type="button" onClick={handleAddGoal} style={styles.primaryButton}>
                  Add Goal
                </button>
              </div>

              <div style={styles.listWrap}>
                {appData.goals.length === 0 ? (
                  <div style={styles.emptyText}>No goals added yet.</div>
                ) : (
                  appData.goals.map((goal) => (
                    <div key={goal.id} style={styles.listRow}>
                      {editingGoalId === goal.id ? (
                        <div style={styles.editStack}>
                          <input
                            style={styles.input}
                            value={editingGoalName}
                            onChange={(e) => setEditingGoalName(e.target.value)}
                          />
                          <button type="button" style={styles.primaryButton} onClick={saveEditGoal}>
                            Save Goal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={styles.flexGrow}>
                            <div style={styles.rowTitle}>{goal.name}</div>
                          </div>
                          {renderMiniActionButtons(
                            () => startEditGoal(goal),
                            () => deleteGoal(goal.id)
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "calendar" && (
          <div style={styles.sectionStack}>
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Calendar</h2>
              </div>

              <div style={styles.calendarWeekHeader}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} style={styles.weekDay}>
                    {day}
                  </div>
                ))}
              </div>

              {renderCalendarGrid()}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>
                  Entries for {formatMonthLabel(currentMonth)} {selectedDay}
                </h2>
              </div>

              <div style={styles.formStack}>
                <input
                  style={styles.input}
                  placeholder="Add calendar entry"
                  value={newCalendarEntry}
                  onChange={(e) => setNewCalendarEntry(e.target.value)}
                />
                <button type="button" onClick={addCalendarEntry} style={styles.primaryButton}>
                  Add Entry
                </button>
              </div>

              <div style={styles.listWrap}>
                {selectedDayEntries.length === 0 ? (
                  <div style={styles.emptyText}>No entries for this day.</div>
                ) : (
                  selectedDayEntries.map((entry) => (
                    <div key={entry.id} style={styles.listRow}>
                      {editingCalendarEntryId === entry.id ? (
                        <div style={styles.editStack}>
                          <input
                            style={styles.input}
                            value={editingCalendarEntryText}
                            onChange={(e) => setEditingCalendarEntryText(e.target.value)}
                          />
                          <button
                            type="button"
                            style={styles.primaryButton}
                            onClick={saveEditCalendarEntry}
                          >
                            Save Entry
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={styles.flexGrow}>
                            <div style={styles.rowTitle}>{entry.text}</div>
                          </div>
                          {renderMiniActionButtons(
                            () => startEditCalendarEntry(entry),
                            () => deleteCalendarEntry(entry.id)
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Month Notes</h2>
              </div>
              <textarea
                style={styles.textarea}
                placeholder="Write notes for this month..."
                value={monthBudget.notes}
                onChange={(e) => saveMonthNotes(e.target.value)}
              />
            </section>
          </div>
        )}

        <div style={{ height: 26 }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f7f6f1",
    display: "flex",
    justifyContent: "center",
    padding: "18px 12px 30px",
    boxSizing: "border-box",
  },

  appShell: {
    width: "100%",
    maxWidth: 430,
  },

  hiddenFileInput: {
    display: "none",
  },

  topBar: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    marginBottom: 12,
    minHeight: 42,
  },

  topBarSide: {
    minWidth: 0,
  },

  topBarCenter: {
    display: "flex",
    justifyContent: "center",
  },

  topBarSideRight: {
    display: "flex",
    justifyContent: "flex-end",
  },

  topBarButtons: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginLeft: 10,
  },

  mainTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#141414",
    letterSpacing: "-0.02em",
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  brandWrap: {
  textAlign: "center",
  lineHeight: 1.1
},

brandTitle: {
  fontSize: 34,
  fontWeight: 700,
  margin: 0
},

gold: {
  color: "#C8B98B"
},

subtitle: {
  fontSize: 14,
  opacity: 0.7,
  marginTop: 2
},
  exportButton: {
    height: 32,
    padding: "0 8px",
    borderRadius: 12,
    border: "1px solid #e8dfc8",
    background: "#faf8ef",
    color: "#3d392f",
    fontWeight: 700,
    fontSize: 11,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.04)",
  },

  monthHeroCard: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 14,
    boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
    border: "1px solid #efeada",
    display: "grid",
    gridTemplateColumns: "52px 1fr 52px",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  monthArrow: {
    width: 44,
    height: 44,
    borderRadius: 16,
    border: "1px solid #e8e2cf",
    background: "#faf8ef",
    cursor: "pointer",
    fontSize: 20,
    fontWeight: 800,
    color: "#3f3a30",
    justifySelf: "center",
  },

  monthCenterWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  monthBigLabel: {
    fontSize: 28,
    fontWeight: 800,
    color: "#141414",
    textAlign: "center",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },

  celebrationCard: {
    background: "linear-gradient(180deg, #fffdf7 0%, #f7f2df 100%)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
    border: "1px solid #ece2bc",
    textAlign: "center",
    marginBottom: 14,
  },

  celebrationEmojiRow: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },

  celebrationEmoji: {
    fontSize: 20,
  },

  celebrationTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#2f2a20",
    marginBottom: 4,
  },

  celebrationSubtext: {
    fontSize: 14,
    color: "#6a624f",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 14,
  },

  summaryCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 14,
    boxShadow: "0 8px 20px rgba(0,0,0,0.045)",
    border: "1px solid #efeada",
    minHeight: 88,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },

  summaryLabel: {
    fontSize: 12,
    color: "#827b6b",
    lineHeight: 1.2,
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#141414",
    marginTop: 8,
    wordBreak: "break-word",
  },

  tabBar: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginBottom: 14,
  },

  tabButton: {
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid #ebe4d2",
    background: "#ffffff",
    color: "#665f50",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    padding: "10px 8px",
  },

  tabButtonActive: {
    background: "#e6dfbf",
    color: "#161616",
  },

  sectionStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  card: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
    border: "1px solid #efeada",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#151515",
  },

  sectionMiniTotal: {
    fontSize: 14,
    color: "#716958",
    fontWeight: 700,
  },

  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  input: {
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: "1px solid #e9e3d3",
    padding: "0 14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },

  textarea: {
    width: "100%",
    minHeight: 110,
    borderRadius: 16,
    border: "1px solid #e9e3d3",
    padding: 14,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
    background: "#fff",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#5e594f",
  },

  primaryButton: {
    height: 48,
    borderRadius: 16,
    border: "none",
    background: "#d9d1ad",
    color: "#151515",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },

  collapseButton: {
    width: "100%",
    height: 46,
    borderRadius: 16,
    border: "1px solid #ebe3cc",
    background: "#faf8ef",
    color: "#4f4a40",
    fontWeight: 700,
    cursor: "pointer",
  },

  listWrap: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  listRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 0",
    borderBottom: "1px solid #f0ece0",
  },

  billCheckWrap: {
    paddingTop: 2,
  },

  flexGrow: {
    flex: 1,
    minWidth: 0,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a1a",
    wordBreak: "break-word",
  },

  rowSubtle: {
    marginTop: 4,
    fontSize: 13,
    color: "#7a7362",
  },

  emptyText: {
    color: "#87806f",
    fontSize: 14,
    padding: "6px 0",
  },

  inlineActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginLeft: 6,
  },

  plusButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid #dfd6be",
    background: "#faf8ef",
    color: "#605946",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 18,
    lineHeight: 1,
  },

  minusButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid #efd2d2",
    background: "#fff6f6",
    color: "#b45d5d",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 18,
    lineHeight: 1,
  },

  editStack: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  calendarWeekHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    marginBottom: 8,
  },

  weekDay: {
    textAlign: "center",
    fontSize: 12,
    color: "#857d6c",
    fontWeight: 700,
  },

  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
  },

  calendarEmptyCell: {
    minHeight: 82,
  },

  calendarDayCell: {
    minHeight: 82,
    borderRadius: 14,
    border: "1px solid #ece6d5",
    background: "#fffdf8",
    padding: 6,
    textAlign: "left",
    cursor: "pointer",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  calendarDayCellSelected: {
    background: "#f3edd3",
    border: "1px solid #d9cfaa",
  },

  calendarDayNumber: {
    fontSize: 12,
    fontWeight: 800,
    color: "#4d473c",
    marginBottom: 4,
  },

  calendarPreviewWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  calendarPreviewText: {
    fontSize: 10,
    color: "#655f52",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  calendarMoreText: {
    fontSize: 10,
    color: "#9b927d",
    lineHeight: 1.15,
  },
};