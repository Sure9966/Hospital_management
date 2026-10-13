'use client';

import { useState, useEffect } from 'react';

export interface OpBillingData {
  patientType: 'op' | 'ip';
  opFee: number;
  bedFee: number;
  transferBedFee: number;
  medicinesFee: number;
  hasInsurance: boolean;
  insuranceAmount: number;
  grossTotal: number;
  netPayableTotal: number;
}

interface OpBillingCalculatorProps {
  initialPatientType?: 'op' | 'ip';
  patientName?: string;
  patientId?: string;
  onBillingChange?: (data: OpBillingData) => void;
  onSavePayment?: (data: OpBillingData) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export default function OpBillingCalculator({
  initialPatientType = 'op',
  patientName = '',
  patientId = '',
  onBillingChange,
  onSavePayment,
  isModal = false,
  onClose,
}: OpBillingCalculatorProps) {
  const [patientType, setPatientType] = useState<'op' | 'ip'>(initialPatientType);

  // Fee Input States
  const [opFee, setOpFee] = useState<number>(500); // Standard OP consultation fee
  const [bedFee, setBedFee] = useState<number>(2500); // Inpatient bed fee
  const [transferBedFee, setTransferBedFee] = useState<number>(0); // Transferred bed fee if applicable
  const [medicinesFee, setMedicinesFee] = useState<number>(1200); // Medicines fee up to discharge
  const [hasInsurance, setHasInsurance] = useState<boolean>(false);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);

  // Computed Real-Time Totals
  const grossTotal =
    patientType === 'op'
      ? Number(opFee) || 0
      : (Number(opFee) || 0) +
        (Number(bedFee) || 0) +
        (Number(transferBedFee) || 0) +
        (Number(medicinesFee) || 0);

  const effectiveInsuranceDeduction =
    patientType === 'ip' && hasInsurance ? Math.min(Number(insuranceAmount) || 0, grossTotal) : 0;

  const netPayableTotal = Math.max(0, grossTotal - effectiveInsuranceDeduction);

  // Notify parent on change
  useEffect(() => {
    if (onBillingChange) {
      onBillingChange({
        patientType,
        opFee: Number(opFee) || 0,
        bedFee: patientType === 'ip' ? Number(bedFee) || 0 : 0,
        transferBedFee: patientType === 'ip' ? Number(transferBedFee) || 0 : 0,
        medicinesFee: patientType === 'ip' ? Number(medicinesFee) || 0 : 0,
        hasInsurance: patientType === 'ip' ? hasInsurance : false,
        insuranceAmount: patientType === 'ip' && hasInsurance ? Number(insuranceAmount) || 0 : 0,
        grossTotal,
        netPayableTotal,
      });
    }
  }, [patientType, opFee, bedFee, transferBedFee, medicinesFee, hasInsurance, insuranceAmount, grossTotal, netPayableTotal, onBillingChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSavePayment) {
      onSavePayment({
        patientType,
        opFee: Number(opFee) || 0,
        bedFee: patientType === 'ip' ? Number(bedFee) || 0 : 0,
        transferBedFee: patientType === 'ip' ? Number(transferBedFee) || 0 : 0,
        medicinesFee: patientType === 'ip' ? Number(medicinesFee) || 0 : 0,
        hasInsurance: patientType === 'ip' ? hasInsurance : false,
        insuranceAmount: patientType === 'ip' && hasInsurance ? Number(insuranceAmount) || 0 : 0,
        grossTotal,
        netPayableTotal,
      });
    }
  };

  const content = (
    <div className="op-billing-calculator-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💳 Real-Time OP & Inpatient Billing Calculator</span>
          </h3>
          {patientName && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Patient: <strong>{patientName}</strong> {patientId ? `(${patientId})` : ''}
            </div>
          )}
        </div>
        {isModal && onClose && (
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        )}
      </div>

      {/* Patient Type Selector (OP vs Inpatient IP) */}
      <div style={{ background: 'var(--bg-card, rgba(99, 102, 241, 0.05))', padding: 12, borderRadius: 10, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'block' }}>
          Select Patient Category *
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: `2px solid ${patientType === 'op' ? '#6366f1' : 'var(--border)'}`,
              background: patientType === 'op' ? '#6366f1' : 'var(--bg-surface, #fff)',
              color: patientType === 'op' ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="patientType"
              value="op"
              checked={patientType === 'op'}
              onChange={() => setPatientType('op')}
              style={{ display: 'none' }}
            />
            <span>🩺 Normal Patient (OP)</span>
          </label>

          <label
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: `2px solid ${patientType === 'ip' ? '#10b981' : 'var(--border)'}`,
              background: patientType === 'ip' ? '#10b981' : 'var(--bg-surface, #fff)',
              color: patientType === 'ip' ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="patientType"
              value="ip"
              checked={patientType === 'ip'}
              onChange={() => setPatientType('ip')}
              style={{ display: 'none' }}
            />
            <span>🛏️ Inpatient (IP / Admitted)</span>
          </label>
        </div>
      </div>

      {/* Inputs Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 1. OP Fee Input (ALWAYS PRESENT FOR NORMAL OP & IP) */}
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
            Outpatient (OP) Fee (₹) *
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
            <input
              type="number"
              min={0}
              className="form-control"
              value={opFee}
              onChange={e => setOpFee(Number(e.target.value))}
              placeholder="e.g. 500"
              required
              style={{ paddingLeft: 28, height: 42, fontWeight: 700, fontSize: 15 }}
            />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
            Standard registration & doctor outpatient consultation fee
          </span>
        </div>

        {/* 2. INPATIENT SPECIFIC INPUTS (Conditioned on patientType === 'ip') */}
        {patientType === 'ip' && (
          <div
            style={{
              background: 'var(--bg-surface, #f9fafb)',
              padding: 16,
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🛏️ Inpatient Breakdown Inputs
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {/* Base Bed Fee Input */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Base Ward Bed Fee (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={bedFee}
                    onChange={e => setBedFee(Number(e.target.value))}
                    placeholder="e.g. 2500"
                    style={{ paddingLeft: 24, height: 38, fontSize: 13, fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Transfer Bed Fee Input (If transferred) */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#f59e0b' }}>
                  Transferred Bed Fee (If Transferred) (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={transferBedFee}
                    onChange={e => setTransferBedFee(Number(e.target.value))}
                    placeholder="e.g. 1500 (Optional)"
                    style={{ paddingLeft: 24, height: 38, fontSize: 13, fontWeight: 600, borderColor: transferBedFee > 0 ? '#f59e0b' : undefined }}
                  />
                </div>
              </div>

              {/* Medicines Fee Input (Up to discharge) */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Medicines Fee (Up to Discharge) (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={medicinesFee}
                    onChange={e => setMedicinesFee(Number(e.target.value))}
                    placeholder="e.g. 1200"
                    style={{ paddingLeft: 24, height: 38, fontSize: 13, fontWeight: 600 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                  Includes pharmacy medications and MAR administration logs up to patient discharge
                </span>
              </div>
            </div>

            {/* Insurance Applicable Toggle & Amount Input */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  id="insuranceApplicableCheck"
                  checked={hasInsurance}
                  onChange={e => setHasInsurance(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#0ea5e9', cursor: 'pointer' }}
                />
                <label htmlFor="insuranceApplicableCheck" style={{ fontWeight: 700, fontSize: 13, color: '#0ea5e9', cursor: 'pointer' }}>
                  🛡️ Is Insurance Applicable?
                </label>
              </div>

              {hasInsurance && (
                <div style={{ paddingLeft: 28, animation: 'fadeIn 0.2s ease-in-out' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#0ea5e9' }}>
                    Enter Approved Insurance Claim Amount (₹) *
                  </label>
                  <div style={{ position: 'relative', maxWidth: 300 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>₹</span>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      value={insuranceAmount}
                      onChange={e => setInsuranceAmount(Number(e.target.value))}
                      placeholder="e.g. 3000"
                      style={{ paddingLeft: 24, height: 38, fontSize: 13, fontWeight: 700, borderColor: '#0ea5e9' }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: '#0ea5e9', marginTop: 2, display: 'block' }}>
                    This amount will be automatically deducted from the total bill
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. REAL-TIME TOTAL AMOUNT DISPLAY (CRITICAL REQUIREMENT) */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
            border: '2px solid #10b981',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Calculation Mode:</span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', color: patientType === 'op' ? '#6366f1' : '#10b981' }}>
              {patientType === 'op' ? 'Normal OP Patient' : 'Inpatient (IP)'}
            </span>
          </div>

          {patientType === 'ip' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>OP Registration Fee:</span>
                <strong>₹{(Number(opFee) || 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Base Bed Charges:</span>
                <strong>₹{(Number(bedFee) || 0).toLocaleString()}</strong>
              </div>
              {Number(transferBedFee) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f59e0b' }}>
                  <span>Transferred Bed Charges:</span>
                  <strong>+ ₹{(Number(transferBedFee) || 0).toLocaleString()}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Medicines Charges (Up to discharge):</span>
                <strong>₹{(Number(medicinesFee) || 0).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4 }}>
                <span>Gross Total Amount:</span>
                <span style={{ color: '#6366f1' }}>₹{grossTotal.toLocaleString()}</span>
              </div>
              {hasInsurance && effectiveInsuranceDeduction > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#0ea5e9' }}>
                  <span>Approved Insurance Deduction:</span>
                  <strong>- ₹{effectiveInsuranceDeduction.toLocaleString()}</strong>
                </div>
              )}
            </>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px dashed #10b981',
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>
                REAL-TIME PAYABLE TOTAL:
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Updates instantly as you type
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#10b981', display: 'block', lineHeight: 1 }}>
                ₹{netPayableTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {onSavePayment && (
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              height: 44,
              fontSize: 15,
              fontWeight: 700,
              background: '#10b981',
              borderColor: '#10b981',
              marginTop: 4,
            }}
          >
            💳 Record & Process Payment (₹{netPayableTotal.toLocaleString()})
          </button>
        )}
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 620, padding: 24, borderRadius: 16 }}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
