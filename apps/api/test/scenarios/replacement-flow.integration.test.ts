import assert from "node:assert/strict";
import type { EntityResponse } from "../support/api-test-context";
import {
  apiScenario,
  closeDatabasePoolAfterTests,
  expectStatus,
  managerRequest,
  publicRequest,
  responseJson,
} from "../support/api-test-context";
import {
  assignPerson,
  createAccessToken,
  createCatalog,
  createPerson,
  createSchedule,
  type MemberSchedule,
  publishSchedule,
} from "../support/scenario-builders";

const testCases = [
  {
    name: "Marcelo nao consegue chamar substituto ocupado no mesmo horario",
    async run(context) {
      const { location, scheduleFunction } = await createCatalog(context);
      const original = await createPerson(context, "Bruno Original");
      const candidate = await createPerson(context, "Carla Conflito");
      const startsAt = "2031-04-06T12:00:00.000Z";
      const endsAt = "2031-04-06T13:00:00.000Z";

      const blockerSchedule = await createSchedule(context, {
        title: "Escala que ocupa candidata",
        locationId: location.id,
        functionId: scheduleFunction.id,
        startsAt,
        endsAt,
      });
      await assignPerson(
        context,
        blockerSchedule.id,
        candidate.id,
        "externally_confirmed",
      );
      await publishSchedule(context, blockerSchedule.id);

      const originalSchedule = await createSchedule(context, {
        title: "Escala que precisa de troca",
        locationId: location.id,
        functionId: scheduleFunction.id,
        startsAt,
        endsAt,
      });
      const originalAssignment = await assignPerson(
        context,
        originalSchedule.id,
        original.id,
        "externally_confirmed",
      );
      await publishSchedule(context, originalSchedule.id);

      const token = await createAccessToken(context, original.id);
      const replacementResponse = await publicRequest(
        context,
        "POST",
        `/tenants/${context.tenant.slug}/member-access/${token}/assignments/${originalAssignment.id}/replacement-requests`,
        {
          reason: "Nao consigo participar nesta data",
          urgent: true,
        },
      );
      expectStatus(replacementResponse, 200);

      const replacementPayload = responseJson<
        EntityResponse<{
          schedules: MemberSchedule[];
        }>
      >(replacementResponse);
      const replacementRequestId =
        replacementPayload.data.schedules[0]?.assignment.replacementRequest?.id;
      assert.ok(replacementRequestId, "replacement request should be created");

      const inviteResponse = await managerRequest(
        context,
        "POST",
        `/tenants/${context.tenant.slug}/replacement-requests/${replacementRequestId}/candidates`,
        {
          personId: candidate.id,
        },
      );
      expectStatus(inviteResponse, 409);

      const errorPayload = responseJson<{ error: string }>(inviteResponse);
      assert.equal(errorPayload.error, "person_unavailable");
    },
  },
] satisfies Array<{
  name: string;
  run: Parameters<typeof apiScenario>[1];
}>;

for (const testCase of testCases) {
  apiScenario(testCase.name, testCase.run);
}

closeDatabasePoolAfterTests();
