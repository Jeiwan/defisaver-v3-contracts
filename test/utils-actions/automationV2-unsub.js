const { automationV2UnsubTest } = require('./utils-actions-tests');

describe('AutomationV2-Unsubscribe', function () {
    this.timeout(1000000);

    before(async () => {
    });

    it('... should unsubscribe Aave subscription', async () => {
        await automationV2UnsubTest();
    });
});
