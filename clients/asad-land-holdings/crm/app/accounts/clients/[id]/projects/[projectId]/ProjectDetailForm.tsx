"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";

type Project = {
  id: string;
  client_id: string;
  project_type: string | null;
  linked_property_id: string | null;
  linked_construction_project_id: string | null;
  assigned_to: string | null;
  description: string | null;
  total_agreed_amount_pkr: number | null;
  status: string | null;
};

type Client = { id: string; name: string } | null;
type PropertyOption = { id: string; location: string; property_type: string | null };
type ConstructionOption = { id: string; project_name: string | null; location: string | null };
type Employee = { id: string; name: string };

type Invoice = {
  id: string;
  invoice_number: string | null;
  amount_pkr: number | null;
  description: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: string | null;
};

type Payment = {
  id: string;
  invoice_id: string | null;
  amount_pkr: number | null;
  payment_date: string | null;
  method: string | null;
  notes: string | null;
  payer_type: string | null;
  payer_employee_id: string | null;
  payer_external_name: string | null;
  payer_external_contact: string | null;
  payer_external_notes: string | null;
  employees: { id: string; name: string } | null;
};

type Expense = {
  id: string;
  category: string | null;
  description: string | null;
  amount_pkr: number | null;
  date: string | null;
  funded_by_type: string | null;
  funded_by_employee_id: string | null;
  funded_by_external_name: string | null;
  funded_by_external_contact: string | null;
  funded_by_external_notes: string | null;
  employees: { id: string; name: string } | null;
};

const PROJECT_TYPE_OPTIONS = [
  { value: "sale_purchase", label: "Sale / Purchase" },
  { value: "construction", label: "Construction" },
  { value: "consultancy", label: "Consultancy" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

const PAYER_TYPE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee / Admin" },
  { value: "external", label: "External" },
];

export default function ProjectDetailForm({
  project,
  client,
  properties,
  constructionProjects,
  invoices,
  payments,
  expenses,
  employees,
  profitLoss,
  profitLossError,
}: {
  project: Project;
  client: Client;
  properties: PropertyOption[];
  constructionProjects: ConstructionOption[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  employees: Employee[];
  profitLoss: any;
  profitLossError: string | null;
}) {
  const router = useRouter();

  // Project fields
  const [projectType, setProjectType] = useState(project.project_type ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status ?? "active");
  const [agreedAmount, setAgreedAmount] = useState(
    project.total_agreed_amount_pkr?.toString() ?? ""
  );
  const [linkedPropertyId, setLinkedPropertyId] = useState(
    project.linked_property_id ?? ""
  );
  const [linkedConstructionId, setLinkedConstructionId] = useState(
    project.linked_construction_project_id ?? ""
  );
  const [savingProject, setSavingProject] = useState(false);
  const [projectSaved, setProjectSaved] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const handleSaveProject = async () => {
    setSavingProject(true);
    setProjectError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("client_projects")
      .update({
        project_type: projectType || null,
        description: description.trim() || null,
        status: status || null,
        total_agreed_amount_pkr: agreedAmount ? Number(agreedAmount) : null,
        linked_property_id: linkedPropertyId || null,
        linked_construction_project_id: linkedConstructionId || null,
      })
      .eq("id", project.id);

    setSavingProject(false);

    if (error) {
      setProjectError(error.message);
      return;
    }

    setProjectSaved(true);
    router.refresh();
  };

  // Invoices
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invAmount, setInvAmount] = useState("");
  const [invDescription, setInvDescription] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const handleAddInvoice = async () => {
    if (!invAmount) {
      setInvoiceError("Amount is required.");
      return;
    }
    setSavingInvoice(true);
    setInvoiceError(null);

    const supabase = createClient();
    const { error } = await supabase.from("invoices").insert({
      client_project_id: project.id,
      amount_pkr: Number(invAmount),
      description: invDescription.trim() || null,
      due_date: invDueDate || null,
      status: "unpaid",
    });

    setSavingInvoice(false);

    if (error) {
      setInvoiceError(error.message);
      return;
    }

    setInvAmount("");
    setInvDescription("");
    setInvDueDate("");
    setShowAddInvoice(false);
    router.refresh();
  };

  // Payments
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payerType, setPayerType] = useState("client");
  const [payerEmployeeId, setPayerEmployeeId] = useState("");
  const [payerExtName, setPayerExtName] = useState("");
  const [payerExtContact, setPayerExtContact] = useState("");
  const [payerExtNotes, setPayerExtNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const resetPaymentForm = () => {
    setPayAmount("");
    setPayMethod("");
    setPayNotes("");
    setPayerType("client");
    setPayerEmployeeId("");
    setPayerExtName("");
    setPayerExtContact("");
    setPayerExtNotes("");
    setShowAddPayment(false);
  };

  const handleAddPayment = async () => {
    if (!payAmount) {
      setPaymentError("Amount is required.");
      return;
    }
    if (payerType === "employee" && !payerEmployeeId) {
      setPaymentError("Select which employee/admin provided the funds.");
      return;
    }
    if (payerType === "external" && !payerExtName.trim()) {
      setPaymentError("External payer name is required.");
      return;
    }

    setSavingPayment(true);
    setPaymentError(null);

    const supabase = createClient();
    const { error } = await supabase.from("payments").insert({
      client_project_id: project.id,
      amount_pkr: Number(payAmount),
      method: payMethod.trim() || null,
      notes: payNotes.trim() || null,
      payer_type: payerType,
      payer_employee_id: payerType === "employee" ? payerEmployeeId : null,
      payer_external_name: payerType === "external" ? payerExtName.trim() : null,
      payer_external_contact:
        payerType === "external" ? payerExtContact.trim() || null : null,
      payer_external_notes:
        payerType === "external" ? payerExtNotes.trim() || null : null,
    });

    setSavingPayment(false);

    if (error) {
      setPaymentError(error.message);
      return;
    }

    resetPaymentForm();
    router.refresh();
  };

  // Expenses
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCategory, setExpCategory] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [fundedByType, setFundedByType] = useState("client");
  const [fundedByEmployeeId, setFundedByEmployeeId] = useState("");
  const [fundedByExtName, setFundedByExtName] = useState("");
  const [fundedByExtContact, setFundedByExtContact] = useState("");
  const [fundedByExtNotes, setFundedByExtNotes] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const resetExpenseForm = () => {
    setExpCategory("");
    setExpDescription("");
    setExpAmount("");
    setFundedByType("client");
    setFundedByEmployeeId("");
    setFundedByExtName("");
    setFundedByExtContact("");
    setFundedByExtNotes("");
    setShowAddExpense(false);
  };

  const handleAddExpense = async () => {
    if (!expAmount) {
      setExpenseError("Amount is required.");
      return;
    }
    if (fundedByType === "employee" && !fundedByEmployeeId) {
      setExpenseError("Select which employee/admin funded this.");
      return;
    }
    if (fundedByType === "external" && !fundedByExtName.trim()) {
      setExpenseError("External funder name is required.");
      return;
    }

    setSavingExpense(true);
    setExpenseError(null);

    const supabase = createClient();
    const { error } = await supabase.from("expenses").insert({
      client_project_id: project.id,
      category: expCategory.trim() || null,
      description: expDescription.trim() || null,
      amount_pkr: Number(expAmount),
      funded_by_type: fundedByType,
      funded_by_employee_id: fundedByType === "employee" ? fundedByEmployeeId : null,
      funded_by_external_name:
        fundedByType === "external" ? fundedByExtName.trim() : null,
      funded_by_external_contact:
        fundedByType === "external" ? fundedByExtContact.trim() || null : null,
      funded_by_external_notes:
        fundedByType === "external" ? fundedByExtNotes.trim() || null : null,
    });

    setSavingExpense(false);

    if (error) {
      setExpenseError(error.message);
      return;
    }

    resetExpenseForm();
    router.refresh();
  };

  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.amount_pkr ?? 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_pkr ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_pkr ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={`/accounts/clients/${project.client_id}`}
        className="text-brown-light text-sm hover:text-brown inline-block"
      >
        ← Back to {client?.name ?? "client"}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink capitalize">
          {project.project_type?.replace("_", " ") ?? "Project"}
        </h1>
        <StatusBadge value={status} />
      </div>

      {/* Project fields */}
      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Project type</label>
            <Select
              value={projectType}
              onChange={setProjectType}
              placeholder="Unselected"
              options={PROJECT_TYPE_OPTIONS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Status</label>
            <Select value={status} onChange={setStatus} placeholder="Unselected" options={STATUS_OPTIONS} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Total agreed amount (PKR)</label>
            <input
              type="number"
              value={agreedAmount}
              onChange={(e) => setAgreedAmount(e.target.value)}
              placeholder="e.g. 5000000"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Linked property</label>
            <Select
              value={linkedPropertyId}
              onChange={setLinkedPropertyId}
              placeholder="None"
              options={properties.map((p) => ({ value: p.id, label: p.location }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Linked construction project</label>
            <Select
              value={linkedConstructionId}
              onChange={setLinkedConstructionId}
              placeholder="None"
              options={constructionProjects.map((c) => ({
                value: c.id,
                label: c.project_name || c.location || "Unnamed",
              }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            rows={2}
          />
        </div>
        {projectError && <p className="text-brick text-sm" role="alert">{projectError}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveProject}
            disabled={savingProject}
            className="px-5 py-2 rounded-md bg-brown text-cream font-medium hover:bg-ink transition-colors disabled:opacity-60"
          >
            {savingProject ? "Saving..." : "Save changes"}
          </button>
          {projectSaved && <span className="text-sage text-sm">Saved</span>}
        </div>
      </div>

      {/* Profit / Loss */}
      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6">
        <h2 className="text-ink font-medium mb-4">Profit / Loss</h2>
        {profitLossError ? (
          <p className="text-brick text-sm">
            Could not load profit/loss: {profitLossError}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-brown-light">Invoiced</p>
              <p className="text-ink font-medium">PKR {totalInvoiced.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-brown-light">Received</p>
              <p className="text-sage font-medium">PKR {totalPaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-brown-light">Expenses</p>
              <p className="text-brick font-medium">PKR {totalExpenses.toLocaleString()}</p>
            </div>
        <div>
              <p className="text-brown-light">Profit / Loss</p>
              <p className="text-ink font-medium">
                {Number.isFinite(Number(profitLoss))
                  ? `PKR ${Number(profitLoss).toLocaleString()}`
                  : `PKR ${(totalPaid - totalExpenses).toLocaleString()}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink font-medium">Invoices</h2>
          {!showAddInvoice && (
            <button
              type="button"
              onClick={() => setShowAddInvoice(true)}
              className="text-brown text-sm font-medium hover:text-ink"
            >
              + Add invoice
            </button>
          )}
        </div>

        {invoices.length === 0 && !showAddInvoice && (
          <p className="text-brown-light text-sm">No invoices yet.</p>
        )}

        {invoices.length > 0 && (
          <div className="space-y-2 mb-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm border-t border-brown-light/20 pt-2">
                <span className="text-ink">{inv.invoice_number || "—"}</span>
                <span className="text-brown-light">
                  {inv.due_date ? `Due ${inv.due_date}` : "No due date"}
                </span>
                <span className="text-ink font-medium">
                  PKR {Number(inv.amount_pkr ?? 0).toLocaleString()}
                </span>
                <StatusBadge value={inv.status} />
              </div>
            ))}
          </div>
        )}

        {showAddInvoice && (
          <div className="border-t border-brown-light/20 pt-3 space-y-2">
            <input
              type="number"
              value={invAmount}
              onChange={(e) => setInvAmount(e.target.value)}
              placeholder="Amount (PKR) *"
              className="input"
            />
            <input
              value={invDescription}
              onChange={(e) => setInvDescription(e.target.value)}
              placeholder="Description (optional)"
              className="input"
            />
            <input
              type="date"
              value={invDueDate}
              onChange={(e) => setInvDueDate(e.target.value)}
              className="input"
            />
            {invoiceError && <p className="text-brick text-sm">{invoiceError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddInvoice}
                disabled={savingInvoice}
                className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
              >
                {savingInvoice ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddInvoice(false)}
                className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink font-medium">Payments</h2>
          {!showAddPayment && (
            <button
              type="button"
              onClick={() => setShowAddPayment(true)}
              className="text-brown text-sm font-medium hover:text-ink"
            >
              + Add payment
            </button>
          )}
        </div>

        {payments.length === 0 && !showAddPayment && (
          <p className="text-brown-light text-sm">No payments recorded yet.</p>
        )}

        {payments.length > 0 && (
          <div className="space-y-2 mb-3">
            {payments.map((p) => (
              <div key={p.id} className="text-sm border-t border-brown-light/20 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink font-medium">
                    PKR {Number(p.amount_pkr ?? 0).toLocaleString()}
                  </span>
                  <span className="text-brown-light">{p.payment_date}</span>
                </div>
                <p className="text-brown-light text-xs">
                  From:{" "}
                  {p.payer_type === "client"
                    ? "Client"
                    : p.payer_type === "employee"
                    ? p.employees?.name ?? "Employee"
                    : `${p.payer_external_name ?? "External"}${
                        p.payer_external_notes ? ` (${p.payer_external_notes})` : ""
                      }`}
                  {p.method ? ` · ${p.method}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {showAddPayment && (
          <div className="border-t border-brown-light/20 pt-3 space-y-2">
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount (PKR) *"
              className="input"
            />
            <input
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              placeholder="Method (e.g. bank transfer, cash)"
              className="input"
            />
            <Select
              value={payerType}
              onChange={setPayerType}
              placeholder="Payer *"
              options={PAYER_TYPE_OPTIONS}
            />
            {payerType === "employee" && (
              <Select
                value={payerEmployeeId}
                onChange={setPayerEmployeeId}
                placeholder="Select employee/admin *"
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
              />
            )}
            {payerType === "external" && (
              <>
                <input
                  value={payerExtName}
                  onChange={(e) => setPayerExtName(e.target.value)}
                  placeholder="External payer name *"
                  className="input"
                />
                <input
                  value={payerExtContact}
                  onChange={(e) => setPayerExtContact(e.target.value)}
                  placeholder="Contact (optional)"
                  className="input"
                />
                <input
                  value={payerExtNotes}
                  onChange={(e) => setPayerExtNotes(e.target.value)}
                  placeholder="Who are they / relationship (optional)"
                  className="input"
                />
              </>
            )}
            <input
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="input"
            />
            {paymentError && <p className="text-brick text-sm">{paymentError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddPayment}
                disabled={savingPayment}
                className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
              >
                {savingPayment ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={resetPaymentForm}
                className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink font-medium">Expenses</h2>
          {!showAddExpense && (
            <button
              type="button"
              onClick={() => setShowAddExpense(true)}
              className="text-brown text-sm font-medium hover:text-ink"
            >
              + Add expense
            </button>
          )}
        </div>

        {expenses.length === 0 && !showAddExpense && (
          <p className="text-brown-light text-sm">No expenses recorded yet.</p>
        )}

        {expenses.length > 0 && (
          <div className="space-y-2 mb-3">
            {expenses.map((e) => (
              <div key={e.id} className="text-sm border-t border-brown-light/20 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink font-medium">
                    PKR {Number(e.amount_pkr ?? 0).toLocaleString()}
                  </span>
                  <span className="text-brown-light">{e.date}</span>
                </div>
                <p className="text-brown-light text-xs">
                  {e.category || "Uncategorized"}
                  {e.description ? ` · ${e.description}` : ""} · Funded by:{" "}
                  {e.funded_by_type === "client"
                    ? "Client"
                    : e.funded_by_type === "employee"
                    ? e.employees?.name ?? "Employee"
                    : `${e.funded_by_external_name ?? "External"}${
                        e.funded_by_external_notes ? ` (${e.funded_by_external_notes})` : ""
                      }`}
                </p>
              </div>
            ))}
          </div>
        )}

        {showAddExpense && (
          <div className="border-t border-brown-light/20 pt-3 space-y-2">
            <input
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              placeholder="Category (optional)"
              className="input"
            />
            <input
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              placeholder="Description (optional)"
              className="input"
            />
            <input
              type="number"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="Amount (PKR) *"
              className="input"
            />
            <Select
              value={fundedByType}
              onChange={setFundedByType}
              placeholder="Funded by *"
              options={PAYER_TYPE_OPTIONS}
            />
            {fundedByType === "employee" && (
              <Select
                value={fundedByEmployeeId}
                onChange={setFundedByEmployeeId}
                placeholder="Select employee/admin *"
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
              />
            )}
            {fundedByType === "external" && (
              <>
                <input
                  value={fundedByExtName}
                  onChange={(e) => setFundedByExtName(e.target.value)}
                  placeholder="External funder name *"
                  className="input"
                />
                <input
                  value={fundedByExtContact}
                  onChange={(e) => setFundedByExtContact(e.target.value)}
                  placeholder="Contact (optional)"
                  className="input"
                />
                <input
                  value={fundedByExtNotes}
                  onChange={(e) => setFundedByExtNotes(e.target.value)}
                  placeholder="Who are they / relationship (optional)"
                  className="input"
                />
              </>
            )}
            {expenseError && <p className="text-brick text-sm">{expenseError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddExpense}
                disabled={savingExpense}
                className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
              >
                {savingExpense ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={resetExpenseForm}
                className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}