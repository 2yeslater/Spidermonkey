/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Check that setting a breakpoint in a line without code in a deeply-nested
 * child script will skip forward.
 */

var gDebuggee;
var gClient;
var gThreadClient;
var gCallback;

function run_test()
{
  run_test_with_server(DebuggerServer, function () {
    run_test_with_server(WorkerDebuggerServer, do_test_finished);
  });
  do_test_pending();
};

function run_test_with_server(aServer, aCallback)
{
  gCallback = aCallback;
  initTestDebuggerServer(aServer);
  gDebuggee = addTestGlobal("test-stack", aServer);
  gClient = new DebuggerClient(aServer.connectPipe());
  gClient.connect(function () {
    attachTestTabAndResume(gClient, "test-stack", function (aResponse, aTabClient, aThreadClient) {
      gThreadClient = aThreadClient;
      test_nested_breakpoint();
    });
  });
}

function test_nested_breakpoint()
{
  gThreadClient.addOneTimeListener("paused", function (aEvent, aPacket) {
    let path = getFilePath('test_breakpoint-06.js');
    let location = { url: path, line: gDebuggee.line0 + 5};
    gThreadClient.setBreakpoint(location, function (aResponse, bpClient) {
      // Check that the breakpoint has properly skipped forward one line.
      do_check_eq(aResponse.actualLocation.url, location.url);
      do_check_eq(aResponse.actualLocation.line, location.line + 1);
      gThreadClient.addOneTimeListener("paused", function (aEvent, aPacket) {
        // Check the return value.
        do_check_eq(aPacket.type, "paused");
        do_check_eq(aPacket.frame.where.url, path);
        do_check_eq(aPacket.frame.where.line, location.line + 1);
        do_check_eq(aPacket.why.type, "breakpoint");
        do_check_eq(aPacket.why.actors[0], bpClient.actor);
        // Check that the breakpoint worked.
        do_check_eq(gDebuggee.a, 1);
        do_check_eq(gDebuggee.b, undefined);

        // Remove the breakpoint.
        bpClient.remove(function (aResponse) {
          gThreadClient.resume(function () {
            gClient.close(gCallback);
          });
        });

      });
      // Continue until the breakpoint is hit.
      gThreadClient.resume();

    });

  });

  gDebuggee.eval("var line0 = Error().lineNumber;\n" +
                 "function foo() {\n" +     // line0 + 1
                 "  function bar() {\n" +   // line0 + 2
                 "    function baz() {\n" + // line0 + 3
                 "      this.a = 1;\n" +    // line0 + 4
                 "      // A comment.\n" +  // line0 + 5
                 "      this.b = 2;\n" +    // line0 + 6
                 "    }\n" +                // line0 + 7
                 "    baz();\n" +           // line0 + 8
                 "  }\n" +                  // line0 + 9
                 "  bar();\n" +             // line0 + 10
                 "}\n" +                    // line0 + 11
                 "debugger;\n" +            // line0 + 12
                 "foo();\n");               // line0 + 13
}