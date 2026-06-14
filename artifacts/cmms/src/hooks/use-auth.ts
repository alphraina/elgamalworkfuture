import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getMe, 
  getGetMeQueryKey,
  login,
  logout,
  type LoginRequest,
  type User
} from "@workspace/api-client-react";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: getGetMeQueryKey(),
    queryFn: () => getMe({ credentials: "include" }),
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => login(credentials, { credentials: "include" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout({ credentials: "include" }),
    onSuccess: () => {
      queryClient.setQueryData(getGetMeQueryKey(), null);
      queryClient.clear();
      window.location.href = "/";
    },
  });

  // Combined roles — primary role + any extra roles assigned by admin
  const allRoles: string[] = [
    user?.role ?? "",
    ...((user as any)?.extraRoles ?? []),
  ].filter(Boolean);

  const hasRole = (...roles: string[]) => roles.some(r => allRoles.includes(r));

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,

    // Role helpers — all check combined primary + extra roles
    isAdmin:      hasRole("admin"),
    isManager:    hasRole("manager"),
    isTeamLeader: hasRole("teamleader"),
    isMaintenance: hasRole("maintenance"),
    isInventory:  hasRole("inventory"),

    // Elevated access: admin | manager | teamleader → full access except user management
    canCreatePlans: hasRole("admin", "manager", "teamleader"),
    // Self-only: only when user has NO elevated role at all
    isSelfOnly: !hasRole("admin", "manager", "teamleader"),
  };
}
