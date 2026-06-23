import { useState } from "react";
import { formatPrice } from "@/services/api";

export function LeaseCalculator({ price }: { price: number }) {
  const [downPaymentPct, setDownPaymentPct] = useState(30);
  const [interestRate, setInterestRate] = useState(15);
  const [years, setYears] = useState(5);

  const downPayment = price * (downPaymentPct / 100);
  const principal = price - downPayment;
  const monthlyInterestRate = (interestRate / 100) / 12;
  const numberOfPayments = years * 12;

  const monthlyPayment =
    monthlyInterestRate === 0
      ? principal / numberOfPayments
      : (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
        
  const totalInterest = (monthlyPayment * numberOfPayments) - principal;

  return (
    <div className="page-panel space-y-6 rounded-xl p-6">
      <div className="flex items-center gap-2">
        <h3 className="field-label text-foreground">Lease payment calculator</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-5 border-b border-white/5 pb-6">
        <div>
          <div className="flex justify-between mb-1">
             <label className="field-label block">Down payment</label>
             <span className="text-xs text-white font-medium">{downPaymentPct}% ({formatPrice(downPayment)})</span>
          </div>
          <input type="range" min="10" max="90" step="5" value={downPaymentPct} onChange={e => setDownPaymentPct(Number(e.target.value))} className="mt-2 h-1.5 w-full appearance-none rounded-full bg-white/10 accent-amber-400 outline-none" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label mb-1 block">Interest rate (%)</label>
            <input type="number" step="0.5" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-sm font-medium text-white outline-none transition-[border-color,background-color,color,box-shadow,transform,opacity] focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="field-label mb-1 block">Term (years)</label>
            <select value={years} onChange={e => setYears(Number(e.target.value))} className="w-full appearance-none rounded-xl border border-white/10 bg-black/60 p-3 text-sm font-medium text-white outline-none transition-[border-color,background-color,color,box-shadow,transform,opacity] focus:ring-1 focus:ring-primary/50">
              <option value="3">3 Years (36 mo)</option>
              <option value="5">5 Years (60 mo)</option>
              <option value="7">7 Years (84 mo)</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
         <div className="flex justify-between items-center px-1">
           <span className="text-xs text-muted-foreground font-medium">Principal Amount</span>
           <span className="text-sm font-medium text-white">{formatPrice(principal)}</span>
         </div>
         <div className="flex justify-between items-center px-1">
           <span className="text-xs text-muted-foreground font-medium">Total Interest Paid</span>
           <span className="text-sm font-medium text-white">{formatPrice(totalInterest)}</span>
         </div>
      </div>
      
      <div className="pt-2">
        <div className="flex flex-col rounded-xl border border-primary/20 bg-primary/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="mb-1 text-sm font-bold uppercase tracking-wider text-primary sm:mb-0">Est. monthly payment</span>
          <span className="text-2xl font-bold text-white tracking-tight">{formatPrice(monthlyPayment)}<span className="text-sm text-muted-foreground font-normal ml-1">/mo</span></span>
        </div>
      </div>
    </div>
  );
}
