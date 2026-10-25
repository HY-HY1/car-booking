import type { Metadata } from "next";
import { connection } from "next/server";
import { z } from "zod";
import { serviceAreaSchema } from "@leadgen/core/booking/config";
import { ComingSoon, PageHeader } from "@/components/dashboard/page-header";
import { NewStaff, StaffEditor, type StaffMember } from "@/components/dashboard/staff-forms";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteStaff, saveStaff } from "./actions";

export const metadata: Metadata = { title: "Staff / Techs" };

const staffRow = z.object({
  id: z.uuid(),
  name: z.string(),
  job_title: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  resource_id: z.uuid().nullable(),
  territory_id: z.string().nullable(),
  active: z.boolean(),
});

export default async function StaffPage({ params }: PageProps<"/app/[tenant]/staff">) {
  await connection();
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  const readOnly = !can("staff.edit");

  // RLS limits every read to this business.
  const supabase = await createClient();
  const [staffResult, resourcesResult, settingsResult] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, job_title, phone, email, notes, resource_id, territory_id, active")
      .eq("tenant_id", tenant.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("resources")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
    supabase.from("booking_settings").select("service_area").eq("tenant_id", tenant.id).maybeSingle(),
  ]);

  const header = (
    <PageHeader
      title="Staff / Techs"
      description="Your team. Link each person to the van or bay they work from and the coverage territory they cover."
    />
  );

  // PGRST205 / 42P01: the staff table isn't in the database yet (migration not pushed).
  if (staffResult.error?.code === "PGRST205" || staffResult.error?.code === "42P01") {
    return (
      <>
        {header}
        <ComingSoon>
          The staff table hasn&apos;t been created yet. Run <code>supabase db push</code> to add it.
        </ComingSoon>
      </>
    );
  }
  if (staffResult.error) throw staffResult.error;
  if (resourcesResult.error) throw resourcesResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const staff: StaffMember[] = z.array(staffRow).parse(staffResult.data);
  const area = serviceAreaSchema.safeParse(settingsResult.data?.service_area);
  // Until territories are saved on the Coverage Area page, the only one is the default.
  const territories =
    area.success && "territories" in area.data
      ? area.data.territories.map((t) => ({ id: t.id, name: t.name }))
      : [{ id: "default", name: "Default territory" }];
  const choices = { resources: resourcesResult.data, territories };
  const active = staff.filter((s) => s.active).length;

  return (
    <div className="grid max-w-3xl gap-4">
      {header}
      {readOnly && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Only the business owner can change the team.</p>
      )}
      {staff.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No one added yet.{readOnly ? "" : " Add yourself and your crew below."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {active} working with you{staff.length > active && `, ${staff.length - active} switched off`}.
        </p>
      )}
      {staff.map((member) => (
        <StaffEditor
          key={member.id}
          member={member}
          choices={choices}
          action={saveStaff.bind(null, slug, member.id)}
          deleteAction={deleteStaff.bind(null, slug, member.id)}
          readOnly={readOnly}
        />
      ))}
      <NewStaff action={saveStaff.bind(null, slug, null)} choices={choices} readOnly={readOnly} />
    </div>
  );
}
