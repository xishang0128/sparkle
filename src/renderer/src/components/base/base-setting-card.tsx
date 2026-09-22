import { Card, Accordion } from '@heroui/react'

import React from 'react'
interface Props {
  header?: string
  children?: React.ReactNode
  className?: string
}

const SettingCard: React.FC<Props> = (props) => {
  const { header, children, className } = props

  return !header ? (
    <Card className={`${className || ''} m-2`}>
      <Card.Content>{children}</Card.Content>
    </Card>
  ) : (
    <Accordion
      allowsMultipleExpanded={false}
      className={`app-accordion ${className || ''} my-2`}
      hideSeparator
    >
      <Accordion.Item
        aria-label={header}
        id={header}
        className="app-accordion__item data-[expanded=true]:pb-2"
      >
        {({ isExpanded }) => (
          <>
            <Accordion.Heading>
              <Accordion.Trigger>
                <span className="flex-1 text-left">{header}</span>

                <svg
                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>{children}</Accordion.Body>
            </Accordion.Panel>
          </>
        )}
      </Accordion.Item>
    </Accordion>
  )
}

export default SettingCard
