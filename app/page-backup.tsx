"use client";

import React, { useMemo, useState } from "react";

type LineItem = {
  id: string;
  name: string;
  amount?: number;
};

type BillItem = {
  id: string;
  name: string;
  amount?: number;
  paid: boolean;
};

type BudgetRow = {
  id: string;
  category: string;
  budgeted?: number;
  actual?: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseMoney(val: string): number | undefined {
  const cleaned = val.replace(/[^\d.]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function Page() {
  const [month, setMonth] = useState("March 2026");

  // Goals
  const [goalInput, setGoalInput] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  // Income + Savings
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmt, setIncomeAmt] = useState("");
  const [incomeItems, setIncomeItems] = useState<LineItem[]>([]);

  const [savingsName, setSavingsName] = useState("");
  const [savingsAmt, setSavingsAmt] = useState("");
  const [savingsItems, setSavingsItems] = useState<LineItem[]>([]);

  // Bills
  const [billName, setBillName] = useState("");
  const [billAmt, setBillAmt] = useState("");
  const [bills, setBills] = useState<BillItem[]>([]);

  // Monthly budget grid
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([
    { id: uid(), category: "Rent" },
    { id: uid(), category: "Utilities" },
    { id: uid(), category: "Groceries" },
    { id: uid(), category: "Gas" },
    { id: uid(), category: "Insurance" },
    { id: uid(), category: "Eating Out" },
    { id: uid(), category: "Shopping" },
    { id: uid(), category: "Subscriptions" },
    { id: uid(), category: "Misc" },
  ]);

  // Totals
  const plannedBillsTotal = useMemo(
    () => bills.reduce((sum, b) => sum + (b.amount ?? 0), 0),
    [bills]
  );

  const paidBillsTotal = useMemo(
    () => bills.reduce((sum, b) => sum + (b.paid ? b.amount ?? 0 : 0), 0),
    [bills]
  );

  const remainingBillsTotal = useMemo(
    () => plannedBillsTotal - paidBillsTotal,
    [plannedBillsTotal, paidBillsTotal]
  );

  const incomeTotal = useMemo(
    () => incomeItems.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    [incomeItems]
  );

  const savingsTotal = useMemo(
    () => savingsItems.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    [savingsItems]
  );

  const budgetedTotal = useMemo(
    () => budgetRows.reduce((sum, r) => sum + (r.budgeted ?? 0), 0),
    [budgetRows]
  );

  const actualTotal = useMemo(
    () => budgetRows.reduce((sum, r) => sum + (r.actual ?? 0), 0),
    [budgetRows]
  );

  // Actions
  function addGoal() {
    const t = goalInput.trim();
    if (!t) return;
    setGoals((g) => [t, ...g]);
    setGoalInput("");
  }

  function addIncome() {
    const name = incomeName.trim();
    const amt = parseMoney(incomeAmt);
    if (!name && amt === undefined) return;
    setIncomeItems((prev) => [{ id: uid(), name: name || "Income", amount: amt }, ...prev]);
    setIncomeName("");
    setIncomeAmt("");
  }

  function addSavings() {
    const name = savingsName.trim();
    const amt = parseMoney(savingsAmt);
    if (!name && amt === undefined) return;
    setSavingsItems((prev) => [{ id: uid(), name: name || "Savings", amount: amt }, ...prev]);
    setSavingsName("");
    setSavingsAmt("");
  }

  function addBill() {
    const name = billName.trim();
    const amt = parseMoney(billAmt);
    if (!name && amt === undefined) return;
    setBills((prev) => [{ id: uid(), name: name || "Bill", amount: amt, paid: false }, ...prev]);
    setBillName("");
    setBillAmt("");
  }

  function toggleBillPaid(id: string) {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: !b.paid } : b)));
  }

  function removeBill(id: string) {
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  function addBudgetRow() {
    setBudgetRows((prev) => [...prev, { id: uid(), category: "New category" }]);
  }

  function removeBudgetRow(id: string) {
    setBudgetRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <main className="min-h-screen bg-planner px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              Budget <span className="text-gold">Planner</span>
            </h1>
            <p className="mt-1 text-sm text-ink/70">White + soft gold · rich and clean</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-ink/80">Month</label>
            <input
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input w-56"
              placeholder="March 2026"
            />
          </div>
        </div>

        {/* Stat cards */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Planned Bills" value={money(plannedBillsTotal)} />
          <StatCard label="Paid" value={money(paidBillsTotal)} />
          <StatCard label="Remaining" value={money(remainingBillsTotal)} />
          <StatCard label="Income" value={money(incomeTotal)} />
          <StatCard label="Savings" value={money(savingsTotal)} />
        </section>

        {/* Two-page planner */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT PAGE */}
          <div className="space-y-6">
            {/* Month Overview */}
            <Card
              title="Month Overview"
              subtitle={month}
              rightSlot={
                <span className="chip">
                  Planner page
                </span>
              }
            >
              {/* Goals */}
              <div className="mb-6">
                <SectionTitle title="Goals" />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="input flex-1"
                    placeholder="e.g., Save $1,000 · Spend less eating out"
                  />
                  <button className="btn" onClick={addGoal}>
                    Add
                  </button>
                </div>

                <div className="mt-4">
                  {goals.length === 0 ? (
                    <p className="text-sm text-ink/60">No goals yet.</p>
                  ) : (
                    <ul className="list-disc space-y-2 pl-5 text-sm text-ink/90">
                      {goals.map((g, idx) => (
                        <li key={`${g}-${idx}`}>{g}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Income + Savings */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MiniCard title="Income">
                  <div className="flex flex-col gap-3">
                    <input
                      value={incomeName}
                      onChange={(e) => setIncomeName(e.target.value)}
                      className="input"
                      placeholder="Paycheck, side gig..."
                    />
                    <div className="flex gap-3">
                      <input
                        value={incomeAmt}
                        onChange={(e) => setIncomeAmt(e.target.value)}
                        className="input flex-1"
                        placeholder="$ (optional)"
                        inputMode="decimal"
                      />
                      <button className="btn" onClick={addIncome}>
                        Add
                      </button>
                    </div>

                    {incomeItems.length === 0 ? (
                      <p className="text-sm text-ink/60">None yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {incomeItems.slice(0, 6).map((i) => (
                          <RowLine
                            key={i.id}
                            left={i.name}
                            right={i.amount !== undefined ? money(i.amount) : ""}
                          />
                        ))}
                        {incomeItems.length > 6 && (
                          <p className="text-xs text-ink/50">
                            Showing 6 of {incomeItems.length}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </MiniCard>

                <MiniCard title="Savings">
                  <div className="flex flex-col gap-3">
                    <input
                      value={savingsName}
                      onChange={(e) => setSavingsName(e.target.value)}
                      className="input"
                      placeholder="Emergency fund..."
                    />
                    <div className="flex gap-3">
                      <input
                        value={savingsAmt}
                        onChange={(e) => setSavingsAmt(e.target.value)}
                        className="input flex-1"
                        placeholder="$ (optional)"
                        inputMode="decimal"
                      />
                      <button className="btn" onClick={addSavings}>
                        Add
                      </button>
                    </div>

                    {savingsItems.length === 0 ? (
                      <p className="text-sm text-ink/60">None yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {savingsItems.slice(0, 6).map((i) => (
                          <RowLine
                            key={i.id}
                            left={i.name}
                            right={i.amount !== undefined ? money(i.amount) : ""}
                          />
                        ))}
                        {savingsItems.length > 6 && (
                          <p className="text-xs text-ink/50">
                            Showing 6 of {savingsItems.length}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </MiniCard>
              </div>

              {/* Calendar placeholder */}
              <div className="mt-6">
                <SectionTitle title="Calendar (optional)" />
                <p className="mt-2 text-sm text-ink/60">
                  We can add a month notes grid later. Dates are not required.
                </p>
              </div>
            </Card>
          </div>

          {/* RIGHT PAGE */}
          <div className="space-y-6">
            {/* Bills checklist */}
            <Card title="Bills Checklist" subtitle="Bills do not require dates. Amounts optional.">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  className="input flex-1"
                  placeholder="Rent, phone, internet..."
                />
                <input
                  value={billAmt}
                  onChange={(e) => setBillAmt(e.target.value)}
                  className="input w-40"
                  placeholder="$ (optional)"
                  inputMode="decimal"
                />
                <button className="btn" onClick={addBill}>
                  Add
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  {bills.length === 0 ? (
                    <p className="text-sm text-ink/60">Add your first bill above.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bills.map((b) => (
                        <li key={b.id} className="billRow">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={b.paid}
                              onChange={() => toggleBillPaid(b.id)}
                              className="h-4 w-4 accent-gold"
                            />
                            <span className={`text-sm ${b.paid ? "line-through text-ink/50" : "text-ink"}`}>
                              {b.name}
                            </span>
                          </label>

                          <div className="flex items-center gap-3">
                            <span className="text-sm tabular-nums text-ink/80">
                              {b.amount !== undefined ? money(b.amount) : ""}
                            </span>
                            <button
                              className="iconBtn"
                              onClick={() => removeBill(b.id)}
                              aria-label="Remove bill"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                    <div className="space-y-2">
                      <RowLine left="Planned" right={money(plannedBillsTotal)} />
                      <RowLine left="Paid" right={money(paidBillsTotal)} />
                      <RowLine left="Remaining" right={money(remainingBillsTotal)} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Monthly budget grid */}
            <Card
              title="Monthly Budget"
              subtitle="Categories with budgeted vs actual (planner-style grid)."
              rightSlot={
                <button className="btnGhost" onClick={addBudgetRow}>
                  + Add row
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-ink/70">
                      <th className="py-3 pr-3">Category</th>
                      <th className="py-3 pr-3">Budgeted</th>
                      <th className="py-3 pr-3">Actual</th>
                      <th className="py-3 text-right">Diff</th>
                      <th className="py-3 pl-3 text-right"> </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {budgetRows.map((row) => {
                      const diff = (row.budgeted ?? 0) - (row.actual ?? 0);
                      return (
                        <tr key={row.id} className="align-middle">
                          <td className="py-3 pr-3">
                            <input
                              value={row.category}
                              onChange={(e) =>
                                setBudgetRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r))
                                )
                              }
                              className="input h-10"
                            />
                          </td>

                          <td className="py-3 pr-3">
                            <input
                              inputMode="decimal"
                              placeholder="$"
                              value={row.budgeted === undefined ? "" : String(row.budgeted)}
                              onChange={(e) => {
                                const n = parseMoney(e.target.value);
                                setBudgetRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, budgeted: n } : r))
                                );
                              }}
                              className="input h-10"
                            />
                          </td>

                          <td className="py-3 pr-3">
                            <input
                              inputMode="decimal"
                              placeholder="$"
                              value={row.actual === undefined ? "" : String(row.actual)}
                              onChange={(e) => {
                                const n = parseMoney(e.target.value);
                                setBudgetRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, actual: n } : r))
                                );
                              }}
                              className="input h-10"
                            />
                          </td>

                          <td className="py-3 text-right tabular-nums">
                            <span className={`font-medium ${diff >= 0 ? "text-ink" : "text-red-600"}`}>
                              {money(diff)}
                            </span>
                          </td>

                          <td className="py-3 pl-3 text-right">
                            <button
                              className="iconBtn"
                              onClick={() => removeBudgetRow(row.id)}
                              aria-label="Remove budget row"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td className="py-3 pr-3 font-semibold text-ink">Totals</td>
                      <td className="py-3 pr-3 font-semibold tabular-nums">{money(budgetedTotal)}</td>
                      <td className="py-3 pr-3 font-semibold tabular-nums">{money(actualTotal)}</td>
                      <td className="py-3 text-right font-semibold tabular-nums">{money(budgetedTotal - actualTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="mt-4 text-xs text-ink/55">
                Tip: leave amounts blank if you want. This stays local and private on your computer.
              </p>
            </Card>
          </div>
        </section>

        <p className="mt-8 text-xs text-ink/45">
          Next: we can add local save (localStorage) so your month, bills, and grid persist after refresh.
        </p>
      </div>
    </main>
  );
}

/* Components */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="statCard">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-3 h-1 w-12 rounded-full bg-gold/80" />
    </div>
  );
}

function Card({
  title,
  subtitle,
  rightSlot,
  children,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-wide text-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-ink/60">{subtitle}</p> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
      {children}
    </div>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="miniCard">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/60">{title}</div>
      {children}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/60">{title}</div>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function RowLine({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm text-ink/70">{left}</div>
      <div className="text-sm font-medium tabular-nums text-ink">{right}</div>
    </div>
  );
}