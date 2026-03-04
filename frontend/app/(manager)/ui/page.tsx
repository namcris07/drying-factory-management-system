"use client";

/**
 * app/(manager)/ui/page.tsx
 * Thư viện Components UI
 */
import { Typography, Card, Row, Col, Button, Tag, Space, Switch, Slider, Alert, Progress, Tabs } from 'antd';
import { AppstoreOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function UIComponentsPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <AppstoreOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Thư viện Components
        </Title>
        <Text type="secondary">Các thành phần UI được sử dụng trong hệ thống DryTech</Text>
      </div>

      <Tabs
        items={[
          {
            key: 'buttons',
            label: 'Buttons',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Space wrap>
                  <Button type="primary">Primary</Button>
                  <Button>Default</Button>
                  <Button type="dashed">Dashed</Button>
                  <Button type="text">Text</Button>
                  <Button type="link">Link</Button>
                  <Button danger>Danger</Button>
                  <Button type="primary" loading>Loading</Button>
                </Space>
              </Card>
            ),
          },
          {
            key: 'tags',
            label: 'Tags',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Space wrap>
                  <Tag color="success">Success</Tag>
                  <Tag color="processing">Processing</Tag>
                  <Tag color="error">Error</Tag>
                  <Tag color="warning">Warning</Tag>
                  <Tag color="default">Default</Tag>
                  <Tag color="blue">Blue</Tag>
                  <Tag color="green">Green</Tag>
                  <Tag color="red">Red</Tag>
                </Space>
              </Card>
            ),
          },
          {
            key: 'alerts',
            label: 'Alerts',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert message="Success Alert" type="success" showIcon />
                <Alert message="Info Alert" type="info" showIcon />
                <Alert message="Warning Alert" type="warning" showIcon />
                <Alert message="Error Alert" type="error" showIcon />
              </Space>
            ),
          },
          {
            key: 'progress',
            label: 'Progress',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Progress percent={30} />
                  <Progress percent={50} status="active" />
                  <Progress percent={70} status="exception" />
                  <Progress percent={100} />
                  <Space>
                    <Progress type="circle" percent={75} />
                    <Progress type="circle" percent={100} />
                    <Progress type="circle" percent={50} status="exception" />
                  </Space>
                </Space>
              </Card>
            ),
          },
          {
            key: 'inputs',
            label: 'Inputs',
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Space direction="vertical" style={{ width: 300 }}>
                  <Text strong>Switch</Text>
                  <Switch defaultChecked />
                  <Text strong style={{ marginTop: 16 }}>Slider</Text>
                  <Slider defaultValue={30} />
                  <Slider range defaultValue={[20, 50]} />
                </Space>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
