import {
  DataParser,
  Data,
  DataSchema
} from 'geostyler-data';

import {
  get,
  isEmpty,
  isFinite
} from 'lodash';

import {
  parseString
} from 'xml2js';

import {
  FeatureCollection
} from 'geojson';

/**
 * Interface representing the parameters to be send to WFS
 */
interface WfsParams {
  url: string;
  version: string;
  typeName: string;
  featureID?: string;
  propertyName?: string[];
  maxFeatures?: number;
}

/**
 * Class implementing DataParser to fetch schema and sample data
 * using WFS requests (DescribeFeatureType resp. GetFeature)
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
   * Generate request parameter string for a passed object
   *
   * @param {Object} params Object holding request params
   * @return {string} The URI encoded request parameter string joined with &
   */
  generateRequestParamString(params: any): string {
    return Object.keys(params)
      .filter(key => !isEmpty(params[key]) || isFinite(params[key]))
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&');
  }

  /**
   * Fetch schema and sample data and transforms it to the GeoStyler data model.
   *
   * Currently, WFS service must support application/json as outputFormat
   * and needs CORS headers (only needed if WFS Service is not located on the same origin
   * as the component using this parser) to be available in responses
   *
   * @param wfsConfig The parameters of the WFS
   */
  readData({
    url,
    version,
    typeName,
    maxFeatures = 10,
    propertyName,
    featureID
  }: WfsParams): Promise<Data> {

    const describeFeatureTypeParams = {
      service: this.service,
      version,
      request: 'DescribeFeatureType',
      typenames: typeName
    };

    const getFeatureParams = {
      service: this.service,
      version,
      request: 'GetFeature',
      typenames: typeName,
      featureID,
      outputFormat: 'application/json'
    };
    Object.assign(getFeatureParams, {
      count: maxFeatures
    });

    if (version === '2.0.0') {
      Object.assign(getFeatureParams, {
        count: maxFeatures
      });
    } else {
      Object.assign(getFeatureParams, {
        maxFeatures
      });
    }

    const options = {
      tagNameProcessors: [this.tagNameProcessor]
    };

    // Fetch data schema via describe feature type
    const requestDescribeFeatureType = `${url}?${this.generateRequestParamString(describeFeatureTypeParams)}`;
    const describeFeatureTypePromise = new Promise<DataSchema>((resolve, reject) => {
      fetch(requestDescribeFeatureType)
        .then(response => response.text())
        .then(describeFeatueTypeResult => {
          try {
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
          } catch (error) {
            reject(`Could not parse XML document: ${error}`);
          }
        });
    });

    // Fetch sample data via WFS GetFeature
    const requestGetFeature = `${url}?${this.generateRequestParamString(getFeatureParams)}`;
    const getFeaturePromise = new Promise<FeatureCollection>((resolve, reject) => {
      fetch(requestGetFeature)
        .then(response => response.json())
        .then((getFeatureResult: any) => {
          const fc: FeatureCollection = getFeatureResult as FeatureCollection;
          resolve(fc);
        }).catch(err => {
          const emptyFc: FeatureCollection = {
            type: 'FeatureCollection',
            features: []
          };
          reject(emptyFc);
        });
    });

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
