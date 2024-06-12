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
  outputFormat: 'application/json' | 'application/geo+json';
};

export type RequestParams2_0_0 = {
  version: '2.0.0';
  typeNames: string;
  count?: number;
  outputFormat: 'application/json' | 'application/geo+json';
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
  async readData({
    url,
    requestParams,
    fetchParams = {}
  }: ReadParams): Promise<VectorData> {

    let desribeFeatureTypeOpts;

    if (!requestParams.outputFormat) {
      requestParams.outputFormat = 'application/json';
    }

    if (requestParams.version === '1.1.0') {
      desribeFeatureTypeOpts = {
        version: requestParams.version,
        maxFeatures: requestParams.maxFeatures,
        typeName: requestParams.typeName,
        outputFormat: requestParams.outputFormat
      };
    } else {
      desribeFeatureTypeOpts = {
        version: requestParams.version,
        count: requestParams.count,
        typeNames: requestParams.typeNames,
        outputFormat: requestParams.outputFormat
      };
    }

    // Fetch data schema via describe feature type
    let schema: DataSchema;
    try {
      const requestParamsString =  this.generateRequestParamString({
        ...desribeFeatureTypeOpts,
        service: 'WFS',
        request: 'DescribeFeatureType',
      });
      const requestDescribeFeatureType = `${url}?${requestParamsString}`;
      const describeFeatureTypeResponse = await fetch(requestDescribeFeatureType, fetchParams);
      const describeFeatueTypeResult = await describeFeatureTypeResponse.text();
      const parser = new XMLParser({
        removeNSPrefix: true,
        ignoreDeclaration: true,
        ignoreAttributes: false
      });
      const result = parser.parse(describeFeatueTypeResult);

      let attributes = result?.schema?.complexType?.complexContent?.extension?.sequence?.element

      const properties: { [name: string]: SchemaProperty } = {};
      if (attributes) {
        if (!Array.isArray(attributes)) {
          attributes = [attributes];
        }
        attributes.forEach((attr: any) => {
          const name = attr['@_name'];
          const type = attr['@_type'];
          if (!properties[name]) {
            const propertyType: SchemaProperty = {type: this.mapXsdTypeToJsonDataType(type)};
            properties[name] = propertyType;
          }
        });
      }

      const title = result?.schema?.element?.['@_name'];

      schema = {
        type: 'object',
        title,
        properties
      };
    } catch (error) {
      throw `Could not parse XML document: ${error}`;
    }

    // Fetch sample data via WFS GetFeature
    let exampleFeatures: FeatureCollection;
    try {
      const requestGetFeature = `${url}?${this.generateRequestParamString({
        ...requestParams,
        service: 'WFS',
        request: 'GetFeature',
        outputFormat: 'application/json',
      })}`;
      const getFeatureResponse = await fetch(requestGetFeature, fetchParams);
      const getFeatureResult = await getFeatureResponse.json();
      exampleFeatures = getFeatureResult as FeatureCollection;
    } catch (error) {
      exampleFeatures = {
        type: 'FeatureCollection',
        features: []
      };
    }

    return {
      schema,
      exampleFeatures
    };
  }

}

export default WfsDataParser;
