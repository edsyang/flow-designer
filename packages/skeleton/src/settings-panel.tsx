import { isValidElement, useEffect, useReducer } from "react";
import { DisplayType, setterRegistry } from "@flow-designer/model";
import type { Setting } from "@flow-designer/model";
import type { SettingsPanelProps, SettingFieldProps } from "./types";
import { Field } from "./field";
import { createContent, isReactComponent } from "./create-content";
import styles from "./settings.module.less";

export function SettingsPanel(props: SettingsPanelProps) {
  const settings = props.settings ?? props.node?.getSettings();
  if (!settings) {
    return null;
  }

  const items = settings.getItems();

  return (
    <div className={styles.settings}>
      {items.map((setting: Setting<any>) => (
        <SettingField key={setting.getId()} setting={setting} />
      ))}
    </div>
  );
}

export function SettingField(props: SettingFieldProps) {
  const { setting, className } = props;
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const detach = setting.onBehaviorChange(() => {
      forceUpdate();
    });
    setting.updateBehavior();
    return detach;
  }, [setting]);

  const display = setting.getDisplay();

  if (display === DisplayType.None) {
    return null;
  }

  const changeBehavior = (field: string, flag: boolean) => {
    setting.setBehavior(field, flag);
  };

  if (setting.isGroup()) {
    const childSettings = setting
      .getItems()
      .map((item) => <SettingField key={item.getId()} setting={item} />);

    return (
      <Field
        display={display}
        title={setting.getDescription() || ""}
        tip={setting.getTip()}
        behaviors={setting.getBehaviors()}
        isGroup
        className={className}
        onBehaviorChange={changeBehavior}
      >
        {childSettings}
      </Field>
    );
  }

  return (
    <Field
      display={display}
      title={setting.getDescription() || ""}
      tip={setting.getTip()}
      behaviors={setting.getBehaviors()}
      isGroup={false}
      className={className}
      onBehaviorChange={changeBehavior}
    >
      <SetterRenderer setting={setting} />
    </Field>
  );
}

function SetterRenderer(props: { setting: Setting<any> }) {
  const { setting } = props;
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const detachValue = setting.onValueChange(() => {
      forceUpdate();
    });
    const changeableProps = setting.getSetterChangeableProps();
    const detachFns = changeableProps
      ? changeableProps.map((changeable: any) =>
          changeable.listen(() => {
            forceUpdate();
          }),
        )
      : [];
    return () => {
      detachValue();
      detachFns.forEach((off: () => void) => {
        off();
      });
    };
  }, [setting]);

  let setter = setting.getSetter();
  if (!setter) {
    return null;
  }

  const changeableProps = setting.getSetterChangeableProps();
  const computedProps: Record<string, any> = {};
  if (changeableProps) {
    changeableProps.forEach((changeable: any) => {
      computedProps[changeable.getName()] = changeable.getComputed();
    });
  }
  computedProps.setting = setting;
  computedProps.prop = setting;
  computedProps.field = setting;
  computedProps.value = setting.getValue();
  computedProps.onChange = (newValue: any) => {
    setting.setValue(newValue);
  };

  if (isValidElement(setter) || isReactComponent(setter))
    return createContent(setter, computedProps);

  if (typeof setter === "string") {
    setter = { type: setter };
  }

  if (typeof setter === "object" && setter !== null && "type" in setter) {
    const { type, props: setterProps, ...extraProps } = setter as any;
    const setterType = setterRegistry.getSetter(type);
    if (!setterType) {
      return null;
    }
    return createContent(setterType, {
      ...extraProps,
      ...setterProps,
      ...computedProps,
    });
  }

  const defaultSetter = setterRegistry.getDefaultSetter();
  if (defaultSetter) {
    return createContent(defaultSetter, computedProps);
  }

  return null;
}
