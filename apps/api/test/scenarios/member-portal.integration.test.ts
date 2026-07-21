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
    name: "Marcelo publica uma escala e o membro confirma pelo link",
    async run(context) {
      const { location, scheduleFunction } = await createCatalog(context);
      const person = await createPerson(context, "Ana Confirmacao");
      const schedule = await createSchedule(context, {
        title: "Escala de confirmacao",
        locationId: location.id,
        functionId: scheduleFunction.id,
        startsAt: "2031-03-02T12:00:00.000Z",
        endsAt: "2031-03-02T13:00:00.000Z",
      });
      const assignment = await assignPerson(
        context,
        schedule.id,
        person.id,
        "invited",
      );
      await publishSchedule(context, schedule.id);

      const token = await createAccessToken(context, person.id);
      const schedulesResponse = await publicRequest(
        context,
        "GET",
        `/tenants/${context.tenant.slug}/member-access/${token}/schedules`,
      );
      expectStatus(schedulesResponse, 200);
      const schedulesPayload = responseJson<
        EntityResponse<{
          schedules: MemberSchedule[];
        }>
      >(schedulesResponse);

      assert.equal(schedulesPayload.data.schedules.length, 1);
      assert.equal(
        schedulesPayload.data.schedules[0]?.assignment.status,
        "invited",
      );

      const respondResponse = await publicRequest(
        context,
        "POST",
        `/tenants/${context.tenant.slug}/member-access/${token}/assignments/${assignment.id}/respond`,
        {
          status: "confirmed",
        },
      );
      expectStatus(respondResponse, 200);
      const respondPayload = responseJson<
        EntityResponse<{
          schedules: MemberSchedule[];
        }>
      >(respondResponse);

      assert.equal(
        respondPayload.data.schedules[0]?.assignment.status,
        "confirmed",
      );

      const auditResponse = await managerRequest(
        context,
        "GET",
        `/tenants/${context.tenant.slug}/audit-events?action=assignment.responded&entityId=${schedule.id}`,
      );
      expectStatus(auditResponse, 200);
      const auditPayload = responseJson<
        EntityResponse<
          Array<{
            actor: {
              type: string;
            };
            action: string;
          }>
        >
      >(auditResponse);

      assert.equal(auditPayload.data[0]?.action, "assignment.responded");
      assert.equal(auditPayload.data[0]?.actor.type, "member");
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
