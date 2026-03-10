export type ID = string;

export type Goal = { id: ID; text: string; done: boolean };

export type ChecklistItem = {
  id: ID;
  name: string;
  amountCents?: number;
  categoryId?: ID;
  paid: boolean;
  note?: string;
  optionalDate?: string;
};

export type MoneyItem = { id: ID; name: string; amountCents?: number; note?: string };

export type Category = { id: ID; name: string; budgetCents?: number };

export type MonthData = {
  monthKey: string; // YYYY-MM
  goals: Goal[];
  checklist: ChecklistItem[];
  income: MoneyItem[];
  savings: MoneyItem[];
  categories: Category[];
};

export type AppState = {
  version: number;
  months: Record<string, MonthData>;
};