import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusiness } from "@/contexts/BusinessContext";

export function useTeamMembers() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ["team-members", business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id && !!window.desktopApi?.auth.listMembers,
    queryFn: async () => {
      const response = await window.desktopApi.auth.listMembers({ businessId: business!.id });
      if (response.error) throw new Error(response.error.message);
      return response.data?.members || [];
    },
  });

  const createMember = useMutation({
    mutationFn: async (input: { email: string; password: string; name?: string; role?: string }) => {
      const response = await window.desktopApi.auth.createMember({
        businessId: business!.id,
        email: input.email,
        password: input.password,
        name: input.name,
        role: input.role || "staff",
      });
      if (response.error) throw new Error(response.error.message);
      return response.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      const response = await window.desktopApi.auth.removeMember({
        businessId: business!.id,
        membershipId,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { ...query, createMember, removeMember };
}
