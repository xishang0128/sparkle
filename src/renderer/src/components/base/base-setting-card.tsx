import React from 'react'
import { Accordion, AccordionItem, Card, CardBody } from '@heroui/react'

interface Props {
  header?: string
  children?: React.ReactNode
  className?: string
}

const SettingCard: React.FC<Props> = (props) => {
  const { header, children, className } = props

  return !header ? (
    <Card className={`${className || ''} m-2`}>
      <CardBody>{children}</CardBody>
    </Card>
  ) : (
    <Accordion isCompact className={`${className || ''} my-2`} variant="splitted">
      <AccordionItem
        aria-label={header}
        className="data-[open=true]:pb-2"
        keepContentMounted
        title={<span>{header}</span>}
        indicator={({ isOpen }) => (
          <svg
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
        )}
      >
        {children}
      </AccordionItem>
    </Accordion>
  )
}

export default SettingCard
