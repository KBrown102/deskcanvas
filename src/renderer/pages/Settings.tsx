import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Switch, Card, Divider, message, Button } from 'antd';
import {
  GlobalOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { AppSettings } from '../../main/services/settings-service';

declare global {
  interface Window {
    api: {
      settings: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<{ success: boolean }>;
        getAll: () => Promise<AppSettings>;
        setDataDir: (dataDir: string) => Promise<{ success: boolean }>;
        getDataDir: () => Promise<string>;
      };
      system: {
        selectDirectory: () => Promise<string | null>;
      };
    };
  }
}

const C = {
  text: '#F0F0F5',
  text2: 'rgba(240,240,245,0.6)',
  text3: 'rgba(240,240,245,0.35)',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  brand: '#6C5CE7',
  brandLight: '#A29BFE',
};

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentDataDir, setCurrentDataDir] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await window.api.settings.getAll();
      form.setFieldsValue(settings);
      const dataDir = await window.api.settings.getDataDir();
      setCurrentDataDir(dataDir);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let needRestart = false;
      for (const [key, value] of Object.entries(values)) {
        if (key === 'dataDir') {
          await window.api.settings.setDataDir(value as string);
          needRestart = true;
        } else {
          await window.api.settings.set(key, value);
        }
      }
      message.success(needRestart ? '设置已保存，修改数据存储位置需重启应用生效' : '设置已保存');
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const dataDir = Form.useWatch('dataDir', form);

  /** 选择数据存储目录 */
  const handleSelectDataDir = async () => {
    const dir = await window.api.system.selectDirectory();
    if (dir) {
      form.setFieldsValue({ dataDir: dir });
    }
  };

  /** 重置为默认目录 */
  const handleResetDataDir = () => {
    form.setFieldsValue({ dataDir: '' });
    message.info('已重置为默认路径，保存后重启生效');
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 640 }}>
      <h2 style={{ color: C.text, fontSize: 22, fontWeight: 600, margin: '0 0 24px' }}>
        设置
      </h2>

      {/* 应用设置 */}
      <Card
        size="small"
        style={{ background: C.card, borderColor: C.border, marginBottom: 24 }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <GlobalOutlined style={{ color: C.brand, fontSize: 18 }} />
          <span style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>应用设置</span>
        </div>
        <div style={{ color: C.text3, fontSize: 12, marginBottom: 16 }}>
          语言、启动、数据存储等应用偏好。AI 接口配置已移至「AI 生成」页面。
        </div>

        <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
          <Form.Item label="语言" name="language">
            <Select
              options={[
                { value: 'zh', label: '简体中文' },
                { value: 'en', label: 'English' },
              ]}
              style={{ background: 'rgba(255,255,255,0.04)', color: C.text }}
            />
          </Form.Item>

          <Form.Item label="开机自启" name="autoStart" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="关闭窗口行为"
            name="closeBehavior"
            tooltip="点击关闭按钮时的行为"
          >
            <Select
              options={[
                { value: 'ask', label: '每次询问' },
                { value: 'tray', label: '最小化到托盘' },
                { value: 'quit', label: '退出程序' },
              ]}
              style={{ background: 'rgba(255,255,255,0.04)', color: C.text }}
            />
          </Form.Item>

          <Form.Item
            label="数据存储位置"
            name="dataDir"
            tooltip="留空则使用默认路径。修改后需重启应用生效。"
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                readOnly
                value={dataDir || currentDataDir}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  color: C.text, fontSize: 12,
                }}
              />
              <Button
                onClick={handleSelectDataDir}
                icon={<FolderOutlined />}
                size="small"
                style={{ background: 'rgba(108,92,231,0.2)', color: C.brandLight, borderColor: C.border }}
              >浏览</Button>
              {dataDir && (
                <Button
                  onClick={handleResetDataDir}
                  size="small"
                  style={{ background: 'rgba(255,255,255,0.04)', color: C.text2, borderColor: C.border }}
                >重置</Button>
              )}
            </div>
          </Form.Item>
        </Form>
      </Card>

      <Divider style={{ borderColor: C.border, margin: '0 0 16px' }} />

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Button
          onClick={handleSave}
          type="primary"
          loading={saving}
          style={{ background: C.brand, borderColor: C.brand }}
        >
          保存设置
        </Button>
      </div>
    </div>
  );
};

export default Settings;
