"use client";

import { useRef, useState } from "react";
import { recordDeliveryAttemptAction } from "@/app/actions/deliveries";
import { ActionForm } from "@/components/action-form";
import { inputClass, Field } from "@/components/ui";

/** Canvas de signature — le tracé est converti en PNG (dataURL) et stocké comme preuve. */
function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(false);
  const [value, setValue] = useState("");
  const drawing = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <canvas
        ref={canvasRef}
        width={560}
        height={180}
        className="w-full max-w-lg touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#0d1c31";
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          setHasInk(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
          setValue(canvasRef.current!.toDataURL("image/png"));
        }}
        onPointerLeave={() => {
          if (drawing.current) {
            drawing.current = false;
            setValue(canvasRef.current!.toDataURL("image/png"));
          }
        }}
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-slate-400">Signature du réceptionnaire (doigt ou souris)</p>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-red-600"
          onClick={() => {
            const canvas = canvasRef.current!;
            canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
            setHasInk(false);
            setValue("");
          }}
        >
          Effacer
        </button>
      </div>
      {!hasInk && <p className="text-xs text-amber-600">Signature optionnelle mais recommandée comme preuve de réception.</p>}
    </div>
  );
}

export function DeliveryAttemptForm({
  deliveryId,
  packageTracking,
}: {
  deliveryId: string;
  packageTracking: string;
}) {
  return (
    <ActionForm action={recordDeliveryAttemptAction} submitLabel="Enregistrer la tentative">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Résultat *">
          <select name="outcome" required defaultValue="DELIVERED" className={inputClass}>
            <option value="DELIVERED">Livré — confirmé</option>
            <option value="FAILED">Échec de livraison</option>
            <option value="RESCHEDULED">Reprogrammer</option>
          </select>
        </Field>
        <Field label="Nom du réceptionnaire" hint="Requis si « Livré ».">
          <input name="recipientName" className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lieu">
          <input name="location" className={inputClass} placeholder="Quartier, adresse…" />
        </Field>
        <Field label="Nouvelle date (si reprogrammation)">
          <input type="datetime-local" name="scheduledFor" className={inputClass} />
        </Field>
      </div>
      <Field label="Observation">
        <textarea name="note" rows={2} className={inputClass} placeholder={`Colis ${packageTracking} — détails de la tentative…`} />
      </Field>
      <Field label="Photo (preuve, autorisée)">
        <input type="file" name="photo" accept=".png,.jpg,.jpeg,.webp" className={inputClass} />
      </Field>
      <SignaturePad name="signatureData" />
    </ActionForm>
  );
}
