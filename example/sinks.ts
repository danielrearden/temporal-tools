import { createSink } from "./helpers.js";

export const analytics = createSink("analytics", {
  addEvent: {
    fn: (info, payload) => {
      console.log(`analytics.addEvent called by ${info.workflowType}`, payload);
    },
  },
});
