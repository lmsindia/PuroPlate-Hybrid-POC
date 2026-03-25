const tests = [
  require("./auth.test"),
  require("./checkout.test"),
  require("./products.test"),
  require("./vendors.test"),
  require("./webhook.test")
];

async function main() {
  let failureCount = 0;

  for (const testCase of tests) {
    try {
      await testCase.run();
      console.log(`PASS ${testCase.name}`);
    } catch (err) {
      failureCount += 1;
      console.error(`FAIL ${testCase.name}`);
      console.error(err.stack || err.message);
    }
  }

  if (failureCount > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`PASS ${tests.length} tests`);
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
