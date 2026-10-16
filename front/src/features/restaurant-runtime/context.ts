import { createContext, useContext } from "react";
import type { Membership } from "../../shared/types/models";
export const RestaurantContext = createContext<Membership | null>(null);
export function useRestaurantContext() {
  const membership = useContext(RestaurantContext);
  if (!membership) throw new Error("RestaurantBoundary отсутствует");
  return membership;
}
