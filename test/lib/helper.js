import netStubs from '../fixtures/net-stubs';

export function stubRequests(moxios) {
    const stubsUrl = Object.keys(netStubs);
    stubsUrl.forEach(url => {
        console.log(`Stubing url: ${url}`);
        const stubOpts = netStubs[url];
        let matchUrl = url;
        if (stubOpts.match) {
            matchUrl = stubOpts.match;
        }
        moxios.stubRequest(matchUrl, {
            status: stubOpts.status,
            responseText: stubOpts.responseText
        });
    });    
}