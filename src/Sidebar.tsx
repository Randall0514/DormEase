import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

export type SectionKey = 'home' | 'settings' | 'notifications' | 'profile';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (value: boolean) => void;
  activeSection: SectionKey;
  onSectionChange: (section: SectionKey) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onCollapse,
  activeSection,
  onSectionChange,
}) => {
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      style={{
        background: 'linear-gradient(180deg, #4f73ff 0%, #79acff 100%)',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: collapsed ? 18 : 20,
          letterSpacing: 0.5,
        }}
      >
        {collapsed ? 'DE' : 'DormEase'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeSection]}
        onClick={({ key }) => onSectionChange(key as SectionKey)}
        style={{
          background: 'transparent',
        }}
        items={[
          {
            key: 'home',
            icon: <HomeOutlined />,
            label: 'Home',
          },
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
          },
          {
            key: 'notifications',
            icon: <BellOutlined />,
            label: 'Notifications',
          },
          {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Profile',
          },
        ]}
      />
    </Sider>
  );
};

export default Sidebar;

