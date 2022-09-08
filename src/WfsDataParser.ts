import {
  DataParser,
  VectorData,
  DataSchema,
  SchemaProperty
} from 'geostyler-data';

import { JSONSchema4TypeName } from 'json-schema';

const isEmpty = require('lodash/isEmpty');
const isFinite = require('lodash/isFinite');

import {
  XMLParser
} from 'fast-xml-parser';

import {
  FeatureCollection
} from 'geojson';

export type RequestBaseParams = {
  service: 'WFS';
  request: 'GetFeature' | 'DescribeFeatureType';
  exceptions?: string;
  outputFormat?: string;
};

export type GetFeatureOptionalParams = {
  featureID?: string;
  propertyName?: string;
  sortBy?: string;
  srsName?: string;
};

export type RequestParams1_1_0 = {
  version: '1.1.0';
  typeName: string;
  maxFeatures?: number;
};

export type RequestParams2_0_0 = {
  version: '2.0.0';
  typeNames: string;
  count?: number;
};

export type RequestParams = GetFeatureOptionalParams & (RequestParams1_1_0 | RequestParams2_0_0);
export type DescribeFeatureTypeParams = RequestBaseParams & (RequestParams1_1_0 | RequestParams2_0_0);
export type GetFeatureParams = DescribeFeatureTypeParams & GetFeatureOptionalParams;

/**
 * Interface representing the parameters to be send to WFS
 */
export interface ReadParams {
  url: string;
  requestParams: RequestParams;
  fetchParams?: RequestInit;
}

/**
 * Class implementing DataParser to fetch schema and sample data
 * using WFS requests (DescribeFeatureType resp. GetFeature)
 */
export class WfsDataParser implements DataParser {

  /**
   * The name of the WfsDataParser.
   */
  public static title = 'WFS Data Parser';

  title = 'WFS Data Parser';

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
   * Map XSD datatypes (SimpleType) to json schema data stypes
   *
   * @param qualifiedXsdDataType The XSD datatype as string (including namespace)
   * @returns {JSONSchema4TypeName} The corresponding JSON schema type name
   */
  mapXsdTypeToJsonDataType(qualifiedXsdDataType: string): JSONSchema4TypeName {
    const xsdDataType = qualifiedXsdDataType.indexOf(':') > -1
      ? qualifiedXsdDataType.split(':')[1]
      : qualifiedXsdDataType;

    switch (xsdDataType) {
      case 'string':
        return 'string';
      case 'boolean':
        return 'boolean';
      case 'float':
      case 'double':
      case 'long':
      case 'byte':
      case 'decimal':
      case 'integer':
      case 'int':
      case 'positiveInteger':
      case 'negativeInteger':
      case 'nonPositiveInteger':
      case 'nonNegativeInteger':
      case 'short':
      case 'unsignedLong':
      case 'unsignedInt':
      case 'unsignedShort':
      case 'unsignedByte':
        return 'number';
      default:
        return 'string';
    }
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
    requestParams,
    fetchParams = {}
  }: ReadParams): Promise<VectorData> {

    let desribeFeatureTypeOpts;
    if (requestParams.version === '1.1.0') {
      desribeFeatureTypeOpts = {
        version: requestParams.version,
        maxFeatures: requestParams.maxFeatures,
        typeName: requestParams.typeName
      };
    } else {
      desribeFeatureTypeOpts = {
        version: requestParams.version,
        count: requestParams.count,
        typeNames: requestParams.typeNames
      };
    }

    const describeFeatureTypeParams: DescribeFeatureTypeParams = {
      ...desribeFeatureTypeOpts,
      service: 'WFS',
      request: 'DescribeFeatureType',
    };

    const getFeatureParams: GetFeatureParams = {
      ...requestParams,
      service: 'WFS',
      request: 'GetFeature',
      outputFormat: 'application/json',
    };

    // Fetch data schema via describe feature type
    const requestDescribeFeatureType = `${url}?${this.generateRequestParamString(describeFeatureTypeParams)}`;
    const describeFeatureTypePromise = new Promise<DataSchema>((resolve, reject) => {
      fetch(requestDescribeFeatureType, fetchParams)
        .then(response => response.text())
        .then(describeFeatueTypeResult => {
          try {
            const parser = new XMLParser({
              removeNSPrefix: true,
              ignoreDeclaration: true,
              ignoreAttributes: false
            });
            const result = parser.parse(describeFeatueTypeResult);

            const attributes = result?.schema?.complexType?.complexContent?.extension?.sequence?.element;

            const properties: { [name: string]: SchemaProperty } = {};
            attributes.forEach((attr: any) => {
              const name = attr['@_name'];
              const type = attr['@_type'];
              if (!properties[name]) {
                const propertyType: SchemaProperty = {type: this.mapXsdTypeToJsonDataType(type)};
                properties[name] = propertyType;
              }
            });

            const title = result.schema.element['@_name'];

            const schema: DataSchema = {
              type: 'object',
              title,
              properties
            };

            resolve(schema);
          } catch (error) {
            reject(`Error while parsing DescribeFeatureType response: ${error}`);
          }
        })
        .catch(error => reject(`Could not parse XML document: ${error}`));
    });

    // Fetch sample data via WFS GetFeature
    const requestGetFeature = `${url}?${this.generateRequestParamString(getFeatureParams)}`;
    const getFeaturePromise = new Promise<FeatureCollection>((resolve, reject) => {
      fetch(requestGetFeature, fetchParams)
        .then(response => response.json())
        .then((getFeatureResult: any) => {
          const fc: FeatureCollection = getFeatureResult as FeatureCollection;
          resolve(fc);
        })
        .catch(err => {
          const emptyFc: FeatureCollection = {
            type: 'FeatureCollection',
            features: []
          };
          reject(emptyFc);
        });
    });

    return new Promise<VectorData>((resolve, reject) => {
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
