import { formatPrice } from "@/services/api";

export function TaxBreakdown({ price, engineCapacity = 1500 }: { price: number, engineCapacity?: number }) {
  const customsDuty = price * 0.45;
  const exciseDuty = price * (engineCapacity > 1500 ? 0.70 : 0.40);
  const vat = (price + customsDuty + exciseDuty) * 0.18;
  const surcharge = engineCapacity > 1800 ? 500000 : 0;
  const registrationFee = 25000 + (engineCapacity * 10);
  const totalTaxEst = customsDuty + exciseDuty + vat + surcharge + registrationFee;
  const totalOnRoadPrice = price + totalTaxEst;

  return (
    <div className="page-panel space-y-4 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
         <h3 className="field-label text-zinc-300">Import duty and tax</h3>
         <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-label font-mono font-bold text-amber-300">Estimate</span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-zinc-400 pb-2 border-b border-white/5">
          <span>Base Value (CIF est.)</span>
          <span className="font-medium text-white">{formatPrice(price)}</span>
        </div>
        
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Customs Duty (45%)</span>
          <span className="font-medium text-white">{formatPrice(customsDuty)}</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Excise Duty ({engineCapacity > 1500 ? "70%" : "40%"})</span>
          <span className="font-medium text-white">{formatPrice(exciseDuty)}</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-400">
          <span>VAT (18% on total value)</span>
          <span className="font-medium text-white">{formatPrice(vat)}</span>
        </div>
        
        {(surcharge > 0) && (
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Luxury Surcharge</span>
            <span className="font-medium text-white">{formatPrice(surcharge)}</span>
          </div>
        )}
        
        <div className="flex justify-between text-xs text-zinc-400">
          <span>RMV Registration Fee</span>
          <span className="font-medium text-white">{formatPrice(registrationFee)}</span>
        </div>
      </div>
      
      <div className="pt-4 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
          <span className="text-xs text-zinc-400 font-medium">Total Est. Taxes</span>
          <span className="text-sm font-bold text-amber-400 num">+{formatPrice(totalTaxEst)}</span>
        </div>
        
        <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Estimated on-road price</span>
          <span className="text-lg font-bold text-white tracking-tight">{formatPrice(totalOnRoadPrice)}</span>
        </div>
      </div>
    </div>
  );
}
