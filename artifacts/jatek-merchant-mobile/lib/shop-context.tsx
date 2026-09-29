import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Shop } from '@/lib/api-core';
import { useMe, useShops } from '@/lib/merchant-data';
import { useUpdateMerchantShop } from '@/lib/merchant-parity-data';

type ShopContextValue = {
  shops: Shop[];
  selectedShopId: number | null;
  selectedShop: Shop | null;
  selectShop: (id: number | null) => void;
  canTogglePause: boolean;
  isToggling: boolean;
  togglePause: () => Promise<void>;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: React.PropsWithChildren) {
  const shopsQuery = useShops();
  const meQuery = useMe();
  const updateShop = useUpdateMerchantShop();
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const shops = shopsQuery.data ?? [];
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) ?? null;
  const canTogglePause = meQuery.data?.user.role !== 'employee';

  useEffect(() => {
    if (selectedShopId !== null && !shops.some((shop) => shop.id === selectedShopId)) {
      setSelectedShopId(null);
    }
  }, [selectedShopId, shops]);

  const value = useMemo<ShopContextValue>(() => ({
    shops,
    selectedShopId,
    selectedShop,
    selectShop: setSelectedShopId,
    canTogglePause,
    isToggling: updateShop.isPending,
    togglePause: async () => {
      if (!selectedShop || !canTogglePause || updateShop.isPending) return;
      await updateShop.mutateAsync({
        id: selectedShop.id,
        data: { name: selectedShop.name, isOpen: !selectedShop.isOpen },
      });
    },
  }), [shops, selectedShopId, selectedShop, canTogglePause, updateShop.isPending, updateShop.mutateAsync]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShopContext() {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShopContext doit être utilisé dans ShopProvider.');
  return value;
}