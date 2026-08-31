import React from 'react'
import { Link } from 'react-router-dom'

const BackToHome = () => {
  return (
    <div style={{ margin: '20px 0', textAlign: 'center' }}>
      <Link to="/">
        <button style={{ backgroundColor: '#005F99', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
          Back to Home
        </button>
      </Link>
    </div>
  )
}

export default BackToHome
