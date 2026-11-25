"use client";

import { useState } from "react";
import {
  DEFAULT_JOBS_LABEL,
  JOBS_COUNT_MIN,
  MAX_ENQUIRY_INTRO,
  MAX_JOBS_BEFORE,
  MAX_JOBS_LABEL,
  MAX_POLICY_LINE,
  jobsCountText,
  type PageExtras,
} from "@leadgen/core/branding/extras";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Booking page → Trust and enquiries: the deposit and
// cancellation line by the booking buttons, the jobs completed count in the
// heading, and the enquiry page. Each with a switch, its wording, and what
// customers will see.

export function ExtrasForm({
  extras,
  automaticLine,
  completed,
  enquiryUrl,
  action,
  readOnly,
}: {
  extras: PageExtras;
  // The line made from the deposit and cancellation settings.
  automaticLine: string | null;
  // Bookings marked done so far.
  completed: number;
  enquiryUrl: string;
  action: Action;
  readOnly: boolean;
}) {
  const [policyShow, setPolicyShow] = useState(extras.policy_line.show);
  const [policyText, setPolicyText] = useState(extras.policy_line.text ?? "");
  const [jobsShow, setJobsShow] = useState(extras.jobs_count.show);
  const [jobsLabel, setJobsLabel] = useState(extras.jobs_count.label === DEFAULT_JOBS_LABEL ? "" : extras.jobs_count.label);
  const [jobsBefore, setJobsBefore] = useState(extras.jobs_count.before ? String(extras.jobs_count.before) : "");
  const [enquiriesShow, setEnquiriesShow] = useState(extras.enquiries.show);

  const before = Number(jobsBefore.replace(/,/g, "")) || 0;
  const jobsPreview = jobsCountText(
    { ...extras, jobs_count: { show: true, label: jobsLabel.trim() || DEFAULT_JOBS_LABEL, before } },
    completed,
  );

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-4 rounded-lg border p-4">
            <Switch
              name="policy_show"
              checked={policyShow}
              onChange={(e) => setPolicyShow(e.target.checked)}
              description="A short line under the booking buttons, so customers know where they stand before they start."
            >
              Show your deposit and cancellation terms
            </Switch>
            <div hidden={!policyShow} className="grid gap-3">
              <Preview>{policyText.trim() || automaticLine || "Set your deposit and cancellation rules under Hours & rules first."}</Preview>
              <Field
                label="Your own wording"
                name="policy_text"
                error={errors.policy_text}
                hint="Optional. Blank uses the line above, which follows your deposit and cancellation settings as you change them."
              >
                <Input
                  name="policy_text"
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  maxLength={MAX_POLICY_LINE}
                  placeholder={automaticLine ?? "e.g. £20 deposit · free cancellation up to 2 days before"}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <Switch
              name="jobs_show"
              checked={jobsShow}
              onChange={(e) => setJobsShow(e.target.checked)}
              description={`Under your main heading, counted from bookings you mark as done, rounded down. It shows once you reach ${JOBS_COUNT_MIN}.`}
            >
              Show how many jobs you&apos;ve completed
            </Switch>
            <div hidden={!jobsShow} className="grid gap-3">
              <Preview>
                {jobsPreview ?? `Hidden until you reach ${JOBS_COUNT_MIN}. So far: ${(completed + before).toLocaleString("en-GB")}.`}
              </Preview>
              <div className="grid gap-4 @lg:grid-cols-2">
                <Field label="Wording" name="jobs_label" error={errors.jobs_label} hint={`After the number. Blank says "${DEFAULT_JOBS_LABEL}".`}>
                  <Input
                    name="jobs_label"
                    value={jobsLabel}
                    onChange={(e) => setJobsLabel(e.target.value)}
                    maxLength={MAX_JOBS_LABEL}
                    placeholder="e.g. cars cleaned"
                  />
                </Field>
                <Field
                  label="Jobs before you joined"
                  name="jobs_before"
                  error={errors.jobs_before}
                  hint={`Optional. Added to the ${completed.toLocaleString("en-GB")} booked here.`}
                >
                  <Input
                    name="jobs_before"
                    inputMode="numeric"
                    value={jobsBefore}
                    onChange={(e) => setJobsBefore(e.target.value)}
                    placeholder="0"
                    max={MAX_JOBS_BEFORE}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Only count jobs you really did, from your records. An inflated figure is misleading advertising.
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <Switch
              name="enquiries_show"
              checked={enquiriesShow}
              onChange={(e) => setEnquiriesShow(e.target.checked)}
              description={
                <>
                  A page where customers ask about jobs the instant quote doesn&apos;t fit, like paint correction or a fleet.
                  Each one arrives under Leads, and you&apos;re emailed as with any new lead.{" "}
                  {extras.enquiries.show && (
                    <a href={enquiryUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      See the page
                    </a>
                  )}
                </>
              }
            >
              Show an enquiry page
            </Switch>
            <div hidden={!enquiriesShow}>
              <Field
                label="Introduction"
                name="enquiries_intro"
                error={errors.enquiries_intro}
                hint="Optional. At the top of the page, under the heading."
              >
                <Textarea
                  name="enquiries_intro"
                  rows={2}
                  defaultValue={extras.enquiries.intro ?? ""}
                  maxLength={MAX_ENQUIRY_INTRO}
                  placeholder="e.g. Paint correction, ceramic coatings or a few vans? Tell me about the job and I'll get back to you within a day."
                />
              </Field>
            </div>
          </div>
        </>
      )}
    </SaveForm>
  );
}

function Preview({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Customers see: </span>
      {children}
    </p>
  );
}
