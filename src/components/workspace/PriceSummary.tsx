import React from 'react';
import { formatCentsToBRL } from '../../config/constants.js';
import { Wallet, AlertCircle, ArrowUpRight } from 'lucide-react';

interface PriceSummaryProps {
  totalEstimatedCostCents: number | null;
  unitPriceCents: number | null;
  numberOfOutputs: number;
  availableBalanceCents: number;
  hasSufficientFunds: boolean;
  onNavigateToWallet?: () => void;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  totalEstimatedCostCents,
  unitPriceCents,
  numberOfOutputs,
  availableBalanceCents,
  hasSufficientFunds,
  onNavigateToWallet,
}) => {
  const formattedTotal =
    totalEstimatedCostCents !== null ? formatCentsToBRL(totalEstimatedCostCents) : 'Preço indisponível';

  const formattedBalance = formatCentsToBRL(availableBalanceCents);

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3">
      {/* Price & Balance Row */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block">
            Estimated Cost
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-bold text-zinc-900 font-mono">
              {formattedTotal}
            </span>
            {numberOfOutputs > 1 && unitPriceCents !== null && (
              <span className="text-[10px] text-zinc-400">
                ({numberOfOutputs}x {formatCentsToBRL(unitPriceCents)})
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block">
            Wallet Balance
          </span>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <Wallet className="w-3 h-3 text-zinc-400" />
            <span
              className={`text-xs font-semibold font-mono ${
                hasSufficientFunds ? 'text-zinc-800' : 'text-red-600'
              }`}
            >
              {formattedBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Insufficient Funds warning if applicable */}
      {!hasSufficientFunds && (
        <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
            <span className="text-[11px] truncate">Insufficient credits for generation</span>
          </div>
          {onNavigateToWallet && (
            <button
              type="button"
              onClick={onNavigateToWallet}
              className="text-[11px] font-semibold text-red-700 hover:text-red-800 underline shrink-0 cursor-pointer flex items-center gap-0.5"
            >
              <span>Add credits</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
