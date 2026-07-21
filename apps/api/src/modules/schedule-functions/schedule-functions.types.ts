export type ScheduleFunction = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
};

export type CreateScheduleFunctionInput = {
  name: string;
  description?: string | null;
};
