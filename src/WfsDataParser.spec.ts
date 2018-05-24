import WfsDataParser from './WfsDataParser';

it('WfsDataParser is defined', () => {
  expect(WfsDataParser).toBeDefined();
});

describe('WfsDataParser implements DataParser', () => {

  it('readData is defined', () => {
    const wfsParser = new WfsDataParser();
    expect(wfsParser.readData).toBeDefined();
  });

});
