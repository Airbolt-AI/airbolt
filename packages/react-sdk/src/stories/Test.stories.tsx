import type { Story } from '@ladle/react';

export default {
  title: 'Test/Simple',
};

export const HelloWorld: Story = () => (
  <div style={{ padding: '20px', fontSize: '24px', color: '#333' }}>
    <h1>Hello from Ladle!</h1>
    <p>This is a simple test story without any SDK dependencies.</p>
  </div>
);

export const ButtonTest: Story = () => (
  <div style={{ padding: '20px' }}>
    <button
      onClick={() => alert('Button clicked!')}
      style={{
        padding: '10px 20px',
        fontSize: '16px',
        backgroundColor: '#007aff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Click Me
    </button>
  </div>
);
