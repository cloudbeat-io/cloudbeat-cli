import moxios from 'moxios';
import * as helper from '../lib/helper';
import cmdRunResult from '../../src/cli-commands/run-result';

//jest.mock('axios');
beforeEach(function () {
  // import and pass your custom axios instance to this method
  moxios.install();
  helper.stubRequests(moxios);
});

afterEach(function () {
  // import and pass your custom axios instance to this method
  moxios.uninstall();
});

describe('run case 10 myapikey', () => {
  //axios.get.mockResolvedValue(resp);
  test('should fetch users', async () => {
    // stub process.exit function
    const orgProcExitFunc = process.exit;
    process.exit = jest.fn();
    await cmdRunResult('f31beae3d6684a57a399b6a1d2ce0484', 'DAF78508-C849-4EE0-99C7-F4ABB93AFE99');
    expect(process.exit).toHaveBeenCalledWith(0);
    /*await moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      console.log('Got request:', request);
    });*/
    // or you could use the following depending on your use case:
    // axios.get.mockImplementation(() => Promise.resolve(resp))

    //return Users.all().then(data => expect(data).toEqual(users));
  });
});