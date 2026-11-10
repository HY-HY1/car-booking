"use client";

import { useTransition } from "react";
import { Field, SaveForm, type Action } from "@/components/dashboard/form-kit";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

export function CampaignForm({ action }: { action: Action }) {
  return (
    <SaveForm action={action} submitLabel="Save draft" savedText="Draft saved. Nothing has been sent." resetOnSave>
      {(errors) => (
        <>
          <Field label="Subject" name="subject" error={errors.subject}>
            <Input name="subject" maxLength={150} />
          </Field>
          <Field label="Message" name="body" error={errors.body}>
            <Textarea name="body" rows={8} maxLength={5000} />
          </Field>
        </>
      )}
    </SaveForm>
  );
}

export function CampaignActions({
  audience,
  test,
  start,
  remove,
}: {
  audience: number;
  test: () => Promise<{ error?: string; sentTo?: string }>;
  start: () => Promise<{ error?: string }>;
  remove: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { error, sentTo } = await test();
            if (error) toast.error(error);
            else toast.success(`Test sent to ${sentTo}`);
          })
        }
      >
        Send me a test
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (!(await askToConfirm({ title: "Delete this draft?", confirmLabel: "Delete", destructive: true }))) return;
          startTransition(async () => {
            const { error } = await remove();
            if (error) toast.error(error);
          });
        }}
      >
        Delete
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pending || audience === 0}
        onClick={async () => {
          const ok = await askToConfirm({
            title: `Send this to ${audience} ${audience === 1 ? "person" : "people"}?`,
            description: "Once it's started it can't be called back.",
            confirmLabel: "Send",
          });
          if (!ok) return;
          startTransition(async () => {
            const { error } = await start();
            if (error) toast.error(error);
            else toast.success("Sending now");
          });
        }}
      >
        Send
      </Button>
    </>
  );
}
