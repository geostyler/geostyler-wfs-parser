import { DataParser, Data } from 'geostyler-data';

/**
 *
 */
class WfsDataParser implements DataParser {

  /**
   *
   * @param inputData
   */
  readData(inputData: any): Promise<Data> {

    const promise = new Promise<Data>((resolve, reject) => {
      // If we have a valid data object we can bind it to the promise resolver
      resolve();
    });

    return promise;
  }

}

export default WfsDataParser;
