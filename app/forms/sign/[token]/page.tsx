'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  type FormSimplicityRoom,
  type FsRecipient,
  formDisplayName,
  resolveSignToken,
  signAsRecipient,
} from '@/lib/forms/form-simplicity';

/**
 * Recipient signing room — mirrors Form Simplicity email “Review & Sign” link.
 * Token is stored in localStorage with the room (demo). Production = FS magic link.
 */
export default function FormSimplicitySignPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [room, setRoom] = useState<FormSimplicityRoom | null>(null);
  const [recipient, setRecipient] = useState<FsRecipient | null>(null);
  const [step, setStep] = useState<'review' | 'sign' | 'done' | 'missing'>('review');
  const [fullName, setFullName] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStep('missing');
      return;
    }
    const resolved = resolveSignToken(token);
    if (!resolved) {
      setStep('missing');
      return;
    }
    setRoom(resolved.room);
    setRecipient(resolved.recipient);
    setFullName(resolved.recipient.name);
    if (resolved.recipient.status === 'signed') setStep('done');
  }, [token]);

  const submitSign = () => {
    if (!room || !recipient) return;
    if (!agree) {
      setError('You must agree to use electronic signatures (ESIGN / UETA).');
      return;
    }
    if (fullName.trim().toLowerCase() !== recipient.name.trim().toLowerCase()) {
      setError(`Type your full legal name exactly as invited: ${recipient.name}`);
      return;
    }
    const next = signAsRecipient(room, recipient.role);
    setRoom(next);
    const me = next.recipients.find((r) => r.role === recipient.role) || recipient;
    setRecipient(me);
    setStep('done');
    setError('');
  };

  if (step === 'missing') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border shadow-sm max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Link not found</h1>
          <p className="text-sm text-slate-500 mt-2">
            This signing link is invalid or expired, or was opened in a different browser than the
            one that sent the packet (demo stores tokens in localStorage).
          </p>
          <Link href="/forms" className="inline-block mt-6 text-sm text-emerald-700 underline">
            Back to Forms
          </Link>
        </div>
      </div>
    );
  }

  if (!room || !recipient) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">
        Loading signing room…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Form Simplicity–style top bar */}
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Secure e-signature · Form Simplicity–style room
            </div>
            <h1 className="font-semibold text-lg">{room.roomName}</h1>
          </div>
          <div className="text-right text-xs text-slate-300">
            <div>
              Signing as <span className="text-white font-medium">{recipient.name}</span>
            </div>
            <div className="capitalize text-slate-400">{recipient.role.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-8 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
          This is SummitForge’s <strong>Form Simplicity–style</strong> signing experience for demos
          and training. Production legal IAR forms can also be completed in{' '}
          <a
            href={room.formSimplicityLaunchUrl}
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
          >
            Form Simplicity
          </a>
          .
        </div>

        {step === 'done' || recipient.status === 'signed' ? (
          <div className="bg-white border rounded-2xl p-8 shadow-sm text-center space-y-3">
            <div className="text-4xl">✓</div>
            <h2 className="text-xl font-semibold text-emerald-800">Signature recorded</h2>
            <p className="text-sm text-slate-600">
              Thank you, {recipient.name}. Signed at{' '}
              {recipient.signedAt
                ? new Date(recipient.signedAt).toLocaleString()
                : 'just now'}
              .
            </p>
            {room.status === 'completed' && (
              <p className="text-sm text-emerald-700 font-medium">
                All parties have signed. Certificate of Authenticity is available to the agent.
              </p>
            )}
            {room.status !== 'completed' && (
              <p className="text-xs text-slate-500">
                Waiting on remaining recipients. You may close this window.
              </p>
            )}
            <Link
              href="/forms"
              className="inline-block mt-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-xl"
            >
              Agent: open Forms workspace
            </Link>
          </div>
        ) : (
          <>
            <section className="bg-white border rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-1">Documents to review</h2>
              <p className="text-xs text-slate-500 mb-3">
                Please review each form in this packet before signing (Form Simplicity workflow).
              </p>
              <ul className="divide-y">
                {room.forms.map((f) => (
                  <li key={f.code} className="py-2.5 flex justify-between gap-3 text-sm">
                    <span>
                      <span className="font-mono text-xs text-slate-400 mr-2">{f.code}</span>
                      {f.name || formDisplayName(f.code)}
                    </span>
                    <span className="text-[10px] uppercase text-slate-400">{f.status}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
                <div>
                  <span className="font-medium">Property:</span> {room.propertyLabel}
                </div>
                <div className="mt-1">
                  <span className="font-medium">Packet:</span> {room.package.subject}
                </div>
              </div>
            </section>

            <section className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-slate-900">Adopt electronic signature</h2>
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  I agree to use electronic records and signatures under ESIGN / UETA. I intend my
                  typed name to be my legal signature on the documents listed above.
                </span>
              </label>
              <label className="block text-xs text-slate-500">
                Full legal name (must match invitation)
                <input
                  type="text"
                  className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm text-slate-900"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={recipient.name}
                />
              </label>
              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={submitSign}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
              >
                Sign &amp; finish
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Signature appearance: typed legal name · Audit IP/device captured on submit
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
