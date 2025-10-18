import React from 'react'
import { Accordion, AccordionItem, Card, CardBody } from '@heroui/react'

interface Props {
  title?: string
  children?: React.ReactNode
  className?: string
}

const SettingCard: React.FC<Props> = (props) => {
  return !props.title ? (
    <Card className={`${props.className} m-2`}>
      <CardBody>{props.children}</CardBody>
    </Card>
  ) : (
    <Accordion isCompact className={`${props.className} my-2`} variant="splitted" {...props}>
      <AccordionItem
        className="data-[open=true]:pb-2"
        keepContentMounted
        title={props.title}
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
        {props.children}
      </AccordionItem>
    </Accordion>
  )
}

export default SettingCard
