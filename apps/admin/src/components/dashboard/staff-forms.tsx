"use client";

import { formatPhone } from "@leadgen/core/customer-fields";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AddRow, Check, DeleteButton, Field, Row, SaveForm, fieldClass, type Action } from "./form-kit";

// Staff / Techs: the team list. Each person opens to edit; "Add a person"
// opens the same fields.

export type StaffMember = {
  id: string;
  name: string;
  job_title: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  resource_id: string | null;
  territory_id: string | null;
  active: boolean;
};

export type Option = { id: string; name: string };

type Choices = { resources: Option[]; territories: Option[] };

export function StaffEditor({
  member,
  choices,
  action,
  deleteAction,
  readOnly,
}: {
  member: StaffMember;
  choices: Choices;
  action: Action;
  deleteAction: () => Promise<SaveState>;
  readOnly: boolean;
}) {
  const van = choices.resources.find((r) => r.id === member.resource_id)?.name;
  const territory = choices.territories.find((t) => t.id === member.territory_id)?.name;
  const summary = [member.job_title, member.phone && formatPhone(member.phone), van, territory].filter(Boolean).join(" · ");

  return (
    <Row title={member.name} hidden={!member.active} summary={summary || "No details yet"}>
      <SaveForm
        action={action}
        readOnly={readOnly}
        extra={
          <DeleteButton
            what={member.name}
            note={'To keep them on record but stop using them, untick "Working with us" instead.'}
            action={deleteAction}
          />
        }
      >
        {(errors) => <StaffFields member={member} choices={choices} errors={errors} />}
      </SaveForm>
    </Row>
  );
}

export function NewStaff({ action, choices, readOnly }: { action: Action; choices: Choices; readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <AddRow label="Add a person">
      {(close) => (
        <SaveForm action={action} resetOnSave onSaved={close} submitLabel="Add">
          {(errors) => <StaffFields choices={choices} errors={errors} />}
        </SaveForm>
      )}
    </AddRow>
  );
}

function Select({
  name,
  value,
  options,
  none,
}: {
  name: string;
  value: string | null | undefined;
  options: Option[];
  none: string;
}) {
  return (
    <select name={name} defaultValue={value ?? ""} className={cn(fieldClass, "h-8")}>
      <option value="">{none}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function StaffFields({
  member,
  choices,
  errors,
}: {
  member?: StaffMember;
  choices: Choices;
  errors: Record<string, string | undefined>;
}) {
  // A territory since removed from the map shows as "not assigned" rather than a blank option.
  const territory = choices.territories.some((t) => t.id === member?.territory_id) ? member?.territory_id : null;
  const van = choices.resources.some((r) => r.id === member?.resource_id) ? member?.resource_id : null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" error={errors.name}>
          <Input name="name" autoComplete="off" defaultValue={member?.name ?? ""} />
        </Field>
        <Field label="Job title" name="job_title" error={errors.job_title}>
          <Input name="job_title" autoComplete="off" placeholder="Lead detailer" defaultValue={member?.job_title ?? ""} />
        </Field>
        <Field label="Phone" name="phone" error={errors.phone}>
          <Input name="phone" type="tel" autoComplete="off" defaultValue={member?.phone ? formatPhone(member.phone) : ""} />
        </Field>
        <Field label="Email" name="email" error={errors.email}>
          <Input name="email" type="email" autoComplete="off" defaultValue={member?.email ?? ""} />
        </Field>
        <Field label="Usual van or bay" name="resource_id" error={errors.resource_id}>
          <Select name="resource_id" value={van} options={choices.resources} none="Not assigned" />
        </Field>
        <Field label="Coverage territory" name="territory_id" error={errors.territory_id}>
          <Select name="territory_id" value={territory} options={choices.territories} none="Not assigned" />
        </Field>
      </div>
      <Field label="Notes" name="notes" error={errors.notes}>
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={member?.notes ?? ""}
          className={cn(fieldClass, "min-h-16 py-1.5")}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Check name="active" label="Working with us" defaultChecked={member?.active ?? true} />
        <span className="text-sm text-muted-foreground">Untick to keep them on record without using them.</span>
      </div>
    </>
  );
}
