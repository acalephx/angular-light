(function(){

/*

alight.component('rating', (scope, element, env) => {
  return {
    template,
    templateId,
    templateUrl,
    props,
    onStart,
    onDestroy,
    api
  };
})

<rating :rating="rating" :max="max" @change="rating=$event.value"></rating>

*/

  const f$ = alight.f$;

  function toCamelCase(name) {
    return name.replace(/(-\w)/g, (m) => {
        return m.substring(1).toUpperCase()
    })
  };

  function makeWatch({listener, childCD, name, parentName, parentCD}) {
    let fn;
    let watchOption = {};
    name = toCamelCase(name);
    if(listener && listener !== true) {
      if(f$.isFunction(listener)) {
        fn = listener;
      } else {
        fn = listener.onChange;
        if(listener === 'copy' || listener.watchMode === 'copy') {
          if(fn) fn(parentName)
          else childCD.scope[name] = parentName;
          return
        }
        if(listener === 'array' || listener.watchMode === 'array') watchOption.isArray = true;
        if(listener === 'deep' || listener.watchMode === 'deep') watchOption.deep = true;
      }
    }
    if(!fn) {
      fn = function(value) {
        childCD.scope[name] = value;
        childCD.scan();
      }
    }
    parentCD.watch(parentName, fn, watchOption);
  };

  function bindComponent({attrName, constructor, _parentScope, element, _value, parentEnv}) {
    const scope = {};

    const parentCD = parentEnv.changeDetector.new();
    const childCD = alight.ChangeDetector(scope);

    const env = new Env({
      element,
      attributes: parentEnv.attributes,
      changeDetector: childCD,
      parentChangeDetector: parentCD,
      sendEvent: (eventName, value) => {
        let event = new CustomEvent(eventName);
        event.value = value;
        event.component = true;
        element.dispatchEvent(event);
      }
    });

    try {
      const option = constructor.call(env, scope, element, env) || {};
    } catch (e) {
      alight.exceptionHandler(e, 'Error in component <' + attrName + '>: ', {
        element: element,
        scope: scope,
        cd: childCD
      });
      return;
    }

    if(option.onStart) {
      childCD.watch('$finishBinding', () => {
        option.onStart();
        childCD.scan();
      });
    }

    // bind props
    var parentDestroyed = false;
    parentCD.watch('$destroy', () => {
      parentDestroyed = true;
      childCD.destroy();
    })

    childCD.watch('$destroy', () => {
      if(option.onDestroy) option.onDestroy();
      if(!parentDestroyed) parentCD.destroy();  // child of parentCD
    })

    // api
    for(let attr of element.attributes) {
      if(attr.name[0] !== '#') continue;
      let name = attr.name.slice(1);
      if(!name) continue;
      if(option.api) parentCD.setValue(name, option.api)
      else parentCD.setValue(name, scope)
      break;
    }

    let modelAttr = element.attributes['al-model'];

    function watchProp(key, listener) {
      if(key === '$model') {
        makeWatch({childCD, parentCD, listener, name: '$model', parentName: modelAttr.value});
        modelAttr = null;
      } else {
        let name = ':' + key;
        let value = env.takeAttr(name);
        if(!value) {
          value = env.takeAttr(key);
          if(!value) return;
          listener = 'copy';
        }
        makeWatch({childCD, listener, name: key, parentName: value, parentCD});
      }
    }

    // option props
    if(option.props) {
      if(Array.isArray(option.props))
        for(let key of option.props)
          watchProp(key, true);
      else
        for(let key in option.props)
          watchProp(key, option.props[key]);
    } else {
      // auto props
      for(let attr of element.attributes) {
        let propName = attr.name;
        let propValue = attr.value;
        if(!propValue) continue;

        let parts = propName.match(/^\:(.*)$/)
        if(!parts) continue;
        makeWatch({childCD, name: parts[1], parentName: propValue, parentCD});
      }
    }

    if(modelAttr) watchProp('$model');

    var scanned = false;
    parentCD.watch('$onScanOnce', () => scanned = true);

    // template
    if(option.template) element.innerHTML = option.template;
    if(option.templateId) {
      let templateElement = document.getElementById(option.templateId);
      if(!templateElement) throw 'No template ' + option.templateId;
      element.innerHTML = templateElement.innerHTML;
    }
    if(option.templateUrl) {
      f$.ajax({
        url: option.templateUrl,
        cache: true,
        success: (template) => {
          element.innerHTML = template;
          binding(true);
        },
        error: () => {
          console.error('Template is not loaded',option.templateUrl)
        }
      })
    } else {
      binding();
    }

    function binding(async) {
      if(!scanned) parentCD.digest();
      alight.bind(childCD, element, {skip: true});
    }
  }

  alight.component = function(attrName, constructor) {
    let parts = attrName.match(/^(\w+)[\-](.+)$/)
    let ns, name;
    if(parts) {
      ns = parts[1]
      name = parts[2]
    } else {
      ns = '$global'
      name = attrName
    }
    name = toCamelCase(name);

    if(!alight.d[ns]) alight.d[ns] = {};
    alight.d[ns][name] = {
      restrict: 'E',
      stopBinding: true,
      priority: alight.priority.$component,
      init: function(_parentScope, element, _value, parentEnv) {
        bindComponent({attrName, constructor, _parentScope, element, _value, parentEnv});
      }
    }
  }

})();
