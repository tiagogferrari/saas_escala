import { randomUUID } from "node:crypto";
import type { ApiTestContext, EntityResponse } from "./api-test-context";
import { expectStatus, managerRequest, responseJson } from "./api-test-context";

export type Person = {
  id: string;
  displayName: string;
};

export type Location = {
  id: string;
  name: string;
};

export type ScheduleFunction = {
  id: string;
  name: string;
};

export type ScheduleAssignment = {
  id: string;
  status: string;
  replacementRequest: null | {
    id: string;
    status: string;
  };
};

export type MemberSchedule = {
  assignment: ScheduleAssignment;
  schedule: {
    id: string;
    status: string;
  };
};

export type ScheduleDraft = {
  id: string;
  status: string;
  assignments: ScheduleAssignment[];
};

export async function createCatalog(context: ApiTestContext) {
  const locationResponse = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/locations`,
    {
      name: "Sala Principal",
      address: "Rua dos Testes, 123",
      timezone: "America/Sao_Paulo",
    },
  );
  expectStatus(locationResponse, 201);
  const location =
    responseJson<EntityResponse<Location>>(locationResponse).data;

  const functionResponse = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/functions`,
    {
      name: `Recepcao ${randomUUID().slice(0, 8)}`,
      description: "Apoio de chegada",
    },
  );
  expectStatus(functionResponse, 201);
  const scheduleFunction =
    responseJson<EntityResponse<ScheduleFunction>>(functionResponse).data;

  return { location, scheduleFunction };
}

export async function createPerson(
  context: ApiTestContext,
  displayName: string,
) {
  const response = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/people`,
    {
      displayName,
    },
  );
  expectStatus(response, 201);

  return responseJson<EntityResponse<Person>>(response).data;
}

export async function createSchedule(
  context: ApiTestContext,
  input: {
    functionId: string;
    locationId: string;
    startsAt: string;
    endsAt: string;
    title: string;
    requiredCount?: number;
  },
) {
  const response = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/schedules`,
    {
      title: input.title,
      locationId: input.locationId,
      functionId: input.functionId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      requiredCount: input.requiredCount ?? 1,
    },
  );
  expectStatus(response, 201);

  return responseJson<EntityResponse<ScheduleDraft>>(response).data;
}

export async function assignPerson(
  context: ApiTestContext,
  scheduleId: string,
  personId: string,
  status: "invited" | "externally_confirmed",
) {
  const response = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/schedules/${scheduleId}/assignments`,
    {
      personId,
      status,
    },
  );
  expectStatus(response, 201);

  return responseJson<EntityResponse<ScheduleAssignment>>(response).data;
}

export async function publishSchedule(
  context: ApiTestContext,
  scheduleId: string,
) {
  const response = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/schedules/${scheduleId}/publish`,
  );
  expectStatus(response, 200);

  return responseJson<
    EntityResponse<{
      schedule: ScheduleDraft;
    }>
  >(response).data.schedule;
}

export async function createAccessToken(
  context: ApiTestContext,
  personId: string,
) {
  const response = await managerRequest(
    context,
    "POST",
    `/tenants/${context.tenant.slug}/people/${personId}/access-links`,
  );
  expectStatus(response, 201);

  return responseJson<
    EntityResponse<{
      token: string;
    }>
  >(response).data.token;
}
