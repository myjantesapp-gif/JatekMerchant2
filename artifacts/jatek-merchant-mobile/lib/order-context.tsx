import React, { createContext, useContext, useMemo } from 'react';
import { useOrders, useRejectOrder, useUpdateOrderStatus, useExtendPrepTime } from '@/lib/merchant-data';
import type { OrderDetail } from '@/lib/api-core';
import { SunmiInnerPrinter } from '@/lib/sunmi-printer';
import { IncomingOrderAlert } from '@/components/IncomingOrderAlert';

type OrderContextValue = {
  acceptAndStart: (id: number, prepTimeMinutes: number) => Promise<string | null>;
  reject: (id: number, reason: string) => Promise<void>;
  markReady: (id: number) => Promise<string | null>;
  extendPrepTime: (id: number, prepTimeMinutes: number) => Promise<OrderDetail>;
  printCourierTicket: (order: OrderDetail) => Promise<void>;
  printKitchenTicket: (order: OrderDetail) => Promise<void>;
  isBusy: boolean;
};

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: React.PropsWithChildren) {
  const orderFeed = useOrders();
  const statusMutation = useUpdateOrderStatus();
  const rejectMutation = useRejectOrder();
  const extendMutation = useExtendPrepTime();
  const isBusy = statusMutation.isPending || rejectMutation.isPending || extendMutation.isPending;

  const value = useMemo<OrderContextValue>(() => ({
    acceptAndStart: async (id, prepTimeMinutes) => {
      const acceptedOrder = await statusMutation.mutateAsync({ id, status: 'accepted', prepTimeMinutes });
      let printError: string | null = null;
      try {
        await SunmiInnerPrinter.printKitchenTicket(acceptedOrder);
      } catch (error) {
        printError = error instanceof Error ? error.message : 'Impression cuisine indisponible.';
      }
      await statusMutation.mutateAsync({ id, status: 'preparing' });
      return printError;
    },
    reject: async (id, reason) => {
      await rejectMutation.mutateAsync({ id, reason });
    },
    markReady: async (id) => {
      const readyOrder = await statusMutation.mutateAsync({ id, status: 'ready' });
      try {
        await SunmiInnerPrinter.printCourierTicket(readyOrder);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'Impression du ticket livreur indisponible.';
      }
    },
    extendPrepTime: async (id, prepTimeMinutes) => extendMutation.mutateAsync({ id, prepTimeMinutes }),
    printCourierTicket: (order) => SunmiInnerPrinter.printCourierTicket(order),
    printKitchenTicket: (order) => SunmiInnerPrinter.printKitchenTicket(order),
    isBusy,
  }), [statusMutation.mutateAsync, rejectMutation.mutateAsync, extendMutation.mutateAsync, isBusy]);

  const pendingOrders = useMemo(
    () => (orderFeed.data ?? []).filter((order) => order.status === 'pending').sort((a, b) => (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0)),
    [orderFeed.data],
  );

  return (
    <OrderContext.Provider value={value}>
      {children}
      <IncomingOrderAlert pendingOrders={pendingOrders} loading={orderFeed.isPending} />
    </OrderContext.Provider>
  );
}

export function useOrderContext() {
  const value = useContext(OrderContext);
  if (!value) throw new Error('useOrderContext doit être utilisé dans OrderProvider.');
  return value;
}