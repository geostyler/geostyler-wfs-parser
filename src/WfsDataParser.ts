import { DataParser, Data, DataSchema } from 'geostyler-data';

import { get } from 'lodash';

import {
  parseString
} from 'xml2js';

import {
  FeatureCollection
} from 'geojson';

interface WfsParams {
  url: string;
  version: string;
  typeName: string;
  featureID?: string;
  propertyName?: string[];
}

/**
 *
 */
class WfsDataParser implements DataParser {

  service = 'WFS';

  /**
   * The name Processor is passed as an option to the xml2js parser and modifies
   * the tagName. It strips all namespaces from the tags.
   *
   * @param {string} name The originial tagName
   * @return {string} The modified tagName
   */
  tagNameProcessor(name: string): string {
    const prefixMatch = new RegExp(/(?!xmlns)^.*:/);
    return name.replace(prefixMatch, '');
  }

  /**
   *
   * @param inputData
   */
  readData(wfsConfig: WfsParams): Promise<Data> {

    const {
      url,
      version,
      typeName
    } = wfsConfig;

    const params = {
      service: this.service,
      version,
      request: 'DescribeFeatureType',
      typenames: typeName
    };

    const requestParams = Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key])).join('&');

    const options = {
      tagNameProcessors: [this.tagNameProcessor]
    };

    const requestDescribeFeatureTpye = `${url}?${requestParams}`;
    const describeFeatureTypePromise = new Promise<DataSchema>((resolve, reject) => {
      fetch(requestDescribeFeatureTpye)
        .then(response => response.text())
        .then(describeFeatueTypeResult => {
          parseString(describeFeatueTypeResult, options, (err: any, result: any) => {
            if (err) {
              const msg = `Error while parsing DescribeFeatureType response: ${err}`;
              reject(msg);
            }

            const attributePath = 'schema.complexType[0].complexContent[0].extension[0].sequence[0].element';
            const attributes: any = get(result, attributePath);

            const properties = {};
            attributes.forEach((attr: any) => {
              const { name, type } = get(attr, '$');
              if (!properties[name]) {
                properties[name] = {type};
              }
            });

            const title = get(result, 'schema.element[0].$.name');

            const schema = {
              type: 'object',
              title,
              properties
            };

            resolve(schema);
          });
        });
    });

    // describe feature type
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: []
    };
    const getFeaturePromise = Promise.resolve(fc);

    return new Promise<Data>((resolve, reject) => {
      // Fetch features and type definition in parallel and
      // resolve if both are available
      Promise.all([describeFeatureTypePromise, getFeaturePromise])
        .then(results => {
          const [schema, exampleFeatures ] = results;

          const data = {
            schema,
            exampleFeatures
          };
          resolve(data);
        })
        .catch(error => reject(error));
    });
  }

}

export default WfsDataParser;
