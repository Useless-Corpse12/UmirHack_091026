import { useRestaurantContext } from "../restaurant-runtime/context";
import { managementApi } from "../../shared/api/managementApi";
import { restaurantsApi } from "../../shared/api/restaurantsApi";
import { useMutation } from "../../shared/lib/useMutation";
import { loadMemberships } from "../restaurants/membershipsStore";
import { stopRestaurant } from "../restaurant-runtime/runtimeStore";
import type { InviteRole } from "../../shared/types/models";
export function useInvite() {
  const { restaurantId } = useRestaurantContext();
  const action = useMutation((email: string, role: InviteRole = "manager") =>
    managementApi.invite(restaurantId, email, role),
  );
  return { ...action, invite: action.run };
}
export function useDeleteRestaurant() {
  const { restaurantId } = useRestaurantContext();
  const action = useMutation(async () => {
    await restaurantsApi.remove(restaurantId);
    stopRestaurant();
    await loadMemberships(true).catch(() => {});
  });
  return { ...action, remove: action.run };
}
export function useAcceptInvite() {
  const action = useMutation(async (code: string) => {
    const result = await restaurantsApi.acceptInvite(code);
    await loadMemberships(true).catch(() => {});
    return result;
  });
  return { ...action, accept: action.run };
}
