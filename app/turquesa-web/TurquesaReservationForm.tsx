"use client";

import { useMemo, useState, type FormEvent } from "react";
import styles from "./TurquesaPublicSite.module.css";

type ReservationFormState = {
  guestName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  pax: string;
  note: string;
  website: string;
};

type SubmitState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm: ReservationFormState = {
  guestName: "",
  phone: "",
  email: "",
  date: todayInputValue(),
  time: "19:30",
  pax: "2",
  note: "",
  website: "",
};

export default function TurquesaReservationForm() {
  const [form, setForm] = useState<ReservationFormState>(initialForm);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle", message: "" });
  const isLoading = submitState.status === "loading";
  const canSubmit = useMemo(
    () => Boolean(form.guestName.trim() && (form.phone.trim() || form.email.trim()) && form.date && form.time),
    [form.date, form.email, form.guestName, form.phone, form.time]
  );

  function update<K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isLoading) return;

    setSubmitState({ status: "loading", message: "Enviando solicitud..." });
    try {
      const response = await fetch("/api/turquesa-restaurante/reservas-publicas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudo registrar la solicitud.");

      setForm({ ...initialForm, date: form.date, time: form.time });
      setSubmitState({
        status: "success",
        message: payload.message || "Solicitud recibida. Te confirmaremos disponibilidad.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo registrar la solicitud.",
      });
    }
  }

  return (
    <form className={styles.reserveForm} onSubmit={submit}>
      <div className={styles.reserveGrid}>
        <label className={styles.reserveField}>
          <span>Nombre</span>
          <input
            required
            value={form.guestName}
            onChange={(event) => update("guestName", event.target.value)}
            placeholder="Nombre completo"
            autoComplete="name"
          />
        </label>
        <label className={styles.reserveField}>
          <span>WhatsApp</span>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="809-000-0000"
            autoComplete="tel"
          />
        </label>
      </div>
      <div className={styles.reserveGrid}>
        <label className={styles.reserveField}>
          <span>Fecha</span>
          <input
            required
            type="date"
            value={form.date}
            min={todayInputValue()}
            onChange={(event) => update("date", event.target.value)}
          />
        </label>
        <label className={styles.reserveField}>
          <span>Hora</span>
          <input required type="time" value={form.time} onChange={(event) => update("time", event.target.value)} />
        </label>
        <label className={styles.reserveField}>
          <span>Personas</span>
          <input
            required
            type="number"
            min={1}
            max={50}
            value={form.pax}
            onChange={(event) => update("pax", event.target.value)}
          />
        </label>
      </div>
      <label className={styles.reserveField}>
        <span>Correo</span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="opcional@correo.com"
          autoComplete="email"
        />
      </label>
      <label className={styles.reserveField}>
        <span>Comentario</span>
        <textarea
          value={form.note}
          onChange={(event) => update("note", event.target.value)}
          placeholder="Area preferida, cumpleanos, silla de bebe..."
        />
      </label>
      <input
        className={styles.honeypot}
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(event) => update("website", event.target.value)}
      />
      <button type="submit" disabled={!canSubmit || isLoading}>
        {isLoading ? "Enviando..." : "Solicitar disponibilidad"}
      </button>
      {submitState.message ? (
        <p className={submitState.status === "error" ? styles.reserveError : styles.reserveSuccess}>{submitState.message}</p>
      ) : null}
    </form>
  );
}
