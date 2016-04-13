var _ = require('lodash')

var httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch']

// migrated from bootprint-json-schema
function resolveRef (reference, json) {
  reference = reference.trim()
  if (reference.lastIndexOf('#', 0) < 0) {
    console.warn('Remote references not supported yet. Reference must start with "#" (but was ' + reference + ')')
    return {}
  }
  var components = reference.split('#')
  // var url = components[0]
  var hash = components[1]
  var hashParts = hash.split('/')
  var current = json
  hashParts.forEach(function (hashPart) {
    // Traverse schema from root along the path
    if (hashPart.trim().length > 0) {
      if (typeof current === 'undefined') {
        throw new Error("Reference '" + reference + "' cannot be resolved. '" + hashPart + "' is undefined.")
      }
      current = current[hashPart]
    }
  })
  return current
}

// Preprocessor for the swagger-json, so that some of the logic can be taken out of the
// template

module.exports = function (swaggerJson) {
  var copy = _.cloneDeep(swaggerJson)

  var tagsByName = _.indexBy(copy.tags, 'name')

  copy.tags = copy.tags || []

  // The "body"-parameter in each operation is stored in a
  // separate field "_request_body".
  if (copy.paths) {
    Object.keys(copy.paths).forEach(function (pathName) {
      var path = copy.paths[pathName]
      var pathParameters = path.parameters || []
      Object.keys(path).forEach(function (method) {
        if (httpMethods.indexOf(method) < 0) {
          delete path[method]
          return
        }
        var operation = path[method]
        operation.path = pathName
        operation.method = method
        // Draw links from tags to operations referencing them
        var operationTags = operation.tags || ['default']
        operationTags.forEach(function (tag) {
          if (!tagsByName[tag]) {
            // New implicit declaration of tag not defined in global "tags"-object
            // https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md#user-content-swaggerTags
            var tagDefinition = {
              name: tag,
              operations: []
            }
            tagsByName[tag] = tagDefinition
            copy.tags.push(tagDefinition)
          }
          if (tagsByName[tag]) {
            tagsByName[tag].operations = tagsByName[tag].operations || []
            tagsByName[tag].operations.push(operation)
          }
        })
        // provide path parameters in operation level
        operation.pathParameters = pathParameters
        operation.params = {}
        operation.params['path'] = pathParameters
        operation.parameters.forEach(function (p) {
          if ('$ref' in p) {
            p = resolveRef(p.$ref, copy)
          }
          operation.params[p.in.toLowerCase()] = operation.params[p.in.toLowerCase()] || []
          operation.params[p.in.toLowerCase()].push(p)
        })
        // Show body section, if either a body-parameter or a consumes-property is present.
        operation._show_requst_body_section = operation._request_body || operation.consumes
      })
    })
    // If there are multiple tags, we show the tag-based summary
    copy.showTagSummary = copy.tags.length > 1
  }
  return copy
}
